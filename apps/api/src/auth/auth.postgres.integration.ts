import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { test } from 'node:test';

import { preflightCanonicalUserEmails } from '@lumora/auth';
import {
  disconnectPrismaClient,
  getPrismaClient,
} from '@lumora/database';
import { createEmailVerificationToken } from 'better-auth/api';

const testDatabaseUrl = process.env.AUTH_TEST_DATABASE_URL;

function assertDisposableDatabaseUrl(databaseUrl: string | undefined): asserts databaseUrl is string {
  assert.ok(
    databaseUrl,
    'AUTH_TEST_DATABASE_URL is required. Run this test through pnpm test:auth:postgres.',
  );

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');

  assert.ok(
    ['127.0.0.1', 'localhost'].includes(parsed.hostname),
    'The auth runtime test only accepts a local disposable PostgreSQL server.',
  );
  assert.match(
    databaseName,
    /auth.*test|test.*auth/i,
    'The disposable database name must clearly identify itself as an auth test database.',
  );
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to resolve an available API port.'));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function waitForServerReady(
  baseUrl: string,
  getOutput: () => string,
  timeoutMs = 20_000,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      });

      if (response.status === 200) {
        return;
      }
    } catch {
      // The compiled API is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Compiled API did not become ready.\n${getOutput()}`);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill('SIGTERM');

  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5_000);
    }),
  ]);
}

function parseSessionCookie(response: Response): {
  cookie: string;
  rawToken: string;
  setCookie: string;
} {
  const setCookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('better-auth.session_token='));

  assert.ok(setCookie, 'Better Auth did not issue its session cookie.');
  assert.match(setCookie, /;\s*HttpOnly/i);
  assert.match(setCookie, /;\s*SameSite=Lax/i);

  const cookie = setCookie.split(';', 1)[0];
  assert.ok(cookie, 'The issued session cookie was empty.');

  const encodedValue = cookie.slice(cookie.indexOf('=') + 1);
  const signedValue = decodeURIComponent(encodedValue);
  const rawToken = signedValue.split('.', 1)[0];

  assert.ok(rawToken, 'The issued session cookie did not contain a token.');

  return {
    cookie,
    rawToken,
    setCookie,
  };
}

function assertSafeResponseBody(
  label: string,
  responseBody: string,
  password: string,
  rawTokens: string[],
): void {
  assert.ok(!responseBody.includes(password), `${label} exposed the password.`);

  for (const rawToken of rawTokens) {
    assert.ok(!responseBody.includes(rawToken), `${label} exposed a raw session token.`);
  }
}

async function assertInvalidVerificationResponse(
  response: Response,
  secretInput: string,
): Promise<void> {
  const text = await response.text();

  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(text), {
    statusCode: 400,
    code: 'EMAIL_VERIFICATION_INVALID',
    message: 'This email verification link is invalid or expired.',
  });
  assert.ok(!text.includes(secretInput));
}

function fetchCapturedVerificationEmails(
  baseUrl: string,
  testHttpSecret: string,
): Promise<Response> {
  return fetch(`${baseUrl}/__test/email-verification-deliveries`, {
    headers: { 'x-lumora-test-secret': testHttpSecret },
    signal: AbortSignal.timeout(10_000),
  });
}

test('real PostgreSQL authentication lifecycle uses and revokes a server-managed session', async () => {
  assertDisposableDatabaseUrl(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;

  const prisma = getPrismaClient();
  const apiPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${apiPort}`;
  const submittedEmail = `Auth-Runtime-${randomUUID()}@Example.Test`;
  const email = submittedEmail.toLowerCase();
  const password = `Runtime-${randomBytes(18).toString('base64url')}!`;
  const authSecret = randomBytes(48).toString('base64url');
  const testHttpSecret = randomBytes(32).toString('base64url');
  let childOutput = '';
  let userId: string | undefined;
  let secondUserId: string | undefined;
  const verificationTokens: string[] = [];

  await preflightCanonicalUserEmails();

  const child = spawn('node', ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_TRUSTED_ORIGINS: baseUrl,
      AUTH_EMAIL_VERIFICATION_DELIVERY_MODE: 'capture',
      AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL: `${baseUrl}/verify-email`,
      BETTER_AUTH_SECRET: authSecret,
      BETTER_AUTH_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
      LUMORA_ENABLE_TEST_HTTP_ROUTES: 'true',
      LUMORA_TEST_HTTP_SECRET: testHttpSecret,
      NODE_ENV: 'test',
      PORT: String(apiPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    childOutput += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    childOutput += chunk.toString();
  });

  try {
    await waitForServerReady(baseUrl, () => childOutput);

    const healthResponse = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    const healthBody = (await healthResponse.json()) as {
      checks?: { database?: string };
      status?: string;
    };

    assert.equal(healthResponse.status, 200);
    assert.deepEqual(healthBody, {
      status: 'ok',
      checks: {
        database: 'ok',
      },
    });

    const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify({
        email: submittedEmail,
        name: 'Runtime Verification User',
        password,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const signUpCookie = parseSessionCookie(signUpResponse);
    const signUpText = await signUpResponse.text();

    assert.equal(signUpResponse.status, 200);
    assertSafeResponseBody('sign-up response', signUpText, password, [
      signUpCookie.rawToken,
    ]);

    const signUpBody = JSON.parse(signUpText) as {
      token?: unknown;
      user?: {
        email?: string;
        id?: string;
        name?: string;
        password?: unknown;
      };
    };

    assert.equal(signUpBody.token, undefined);
    assert.equal(signUpBody.user?.password, undefined);
    assert.equal(signUpBody.user?.email, email);
    assert.equal(signUpBody.user?.name, 'Runtime Verification User');
    assert.ok(signUpBody.user?.id);
    userId = signUpBody.user.id;

    assert.equal(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { emailVerified: true },
        })
      ).emailVerified,
      false,
    );
    await preflightCanonicalUserEmails();

    assert.equal(
      (
        await fetch(`${baseUrl}/__test/email-verification-deliveries`, {
          signal: AbortSignal.timeout(10_000),
        })
      ).status,
      404,
    );
    const registrationDeliveriesResponse = await fetchCapturedVerificationEmails(
      baseUrl,
      testHttpSecret,
    );
    const registrationDeliveriesBody =
      (await registrationDeliveriesResponse.json()) as {
        deliveries: Array<{
          confirmationUrl: string;
          expiresInSeconds: number;
          recipient: string;
          templateId: string;
        }>;
      };

    assert.equal(registrationDeliveriesResponse.status, 200);
    assert.equal(registrationDeliveriesBody.deliveries.length, 1);
    assert.equal(registrationDeliveriesBody.deliveries[0]?.recipient, email);
    assert.equal(
      registrationDeliveriesBody.deliveries[0]?.expiresInSeconds,
      900,
    );
    assert.equal(
      registrationDeliveriesBody.deliveries[0]?.templateId,
      'lumora-email-verification-v1',
    );

    const registrationConfirmationUrl = new URL(
      registrationDeliveriesBody.deliveries[0]?.confirmationUrl ?? '',
    );
    assert.equal(registrationConfirmationUrl.origin, baseUrl);
    assert.equal(registrationConfirmationUrl.pathname, '/verify-email');
    assert.equal(registrationConfirmationUrl.search, '');
    const registrationToken = new URLSearchParams(
      registrationConfirmationUrl.hash.slice(1),
    ).get('token');
    assert.ok(registrationToken);
    verificationTokens.push(registrationToken);

    const account = await prisma.account.findFirst({
      where: {
        userId,
        providerId: 'credential',
      },
    });

    assert.ok(account?.password, 'Better Auth did not persist a credential hash.');
    assert.notEqual(account.password, password);
    assert.ok(!account.password.includes(password));

    const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify({
        email,
        password,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const signInCookie = parseSessionCookie(signInResponse);
    const signInText = await signInResponse.text();

    assert.equal(signInResponse.status, 200);
    assertSafeResponseBody('sign-in response', signInText, password, [
      signUpCookie.rawToken,
      signInCookie.rawToken,
    ]);

    const signInBody = JSON.parse(signInText) as {
      token?: unknown;
      user?: { password?: unknown };
    };

    assert.equal(signInBody.token, undefined);
    assert.equal(signInBody.user?.password, undefined);
    assert.equal(
      (
        (await (
          await fetchCapturedVerificationEmails(baseUrl, testHttpSecret)
        ).json()) as { deliveries: unknown[] }
      ).deliveries.length,
      1,
      'sign-in must not issue another verification email',
    );

    const persistedSession = await prisma.session.findUnique({
      where: {
        token: signInCookie.rawToken,
      },
    });

    assert.equal(persistedSession?.userId, userId);

    const meResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Cookie: signInCookie.cookie,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const meText = await meResponse.text();

    assert.equal(meResponse.status, 200);
    assertSafeResponseBody('authenticated /auth/me response', meText, password, [
      signUpCookie.rawToken,
      signInCookie.rawToken,
    ]);
    assert.deepEqual(JSON.parse(meText), {
      email,
      emailVerified: false,
      id: userId,
      name: 'Runtime Verification User',
    });

    const rawVerifyResponse = await fetch(
      `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(registrationToken)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    assert.equal(rawVerifyResponse.status, 404);

    const rawResendResponse = await fetch(
      `${baseUrl}/api/auth/send-verification-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: baseUrl,
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    assert.equal(rawResendResponse.status, 404);

    const scannerGetResponse = await fetch(
      `${baseUrl}/auth/email-verification/confirm?token=${encodeURIComponent(registrationToken)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    assert.equal(scannerGetResponse.status, 404);
    assert.equal(
      (
        await fetch(`${baseUrl}/auth/email-verification/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          signal: AbortSignal.timeout(10_000),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/auth/email-verification/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: registrationToken }),
          signal: AbortSignal.timeout(10_000),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { emailVerified: true },
        })
      ).emailVerified,
      false,
    );

    const callerSelectedEmailResponse = await fetch(
      `${baseUrl}/auth/email-verification/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: signInCookie.cookie,
        },
        body: JSON.stringify({ email: 'other@example.test' }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const callerSelectedEmailText = await callerSelectedEmailResponse.text();
    assert.equal(callerSelectedEmailResponse.status, 400);
    assert.deepEqual(JSON.parse(callerSelectedEmailText), {
      statusCode: 400,
      code: 'INVALID_EMAIL_VERIFICATION_REQUEST',
      message: 'Invalid email verification request.',
    });
    assert.ok(!callerSelectedEmailText.includes('other@example.test'));

    const requestVerificationResponse = await fetch(
      `${baseUrl}/auth/email-verification/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: signInCookie.cookie,
        },
        body: '{}',
        signal: AbortSignal.timeout(10_000),
      },
    );
    assert.equal(requestVerificationResponse.status, 202);
    assert.deepEqual(await requestVerificationResponse.json(), {
      status: 'accepted',
    });

    const requestedDeliveries = (await (
      await fetchCapturedVerificationEmails(baseUrl, testHttpSecret)
    ).json()) as {
      deliveries: Array<{ confirmationUrl: string; recipient: string }>;
    };
    assert.equal(requestedDeliveries.deliveries.length, 2);
    assert.equal(requestedDeliveries.deliveries[1]?.recipient, email);
    const confirmationToken = new URLSearchParams(
      new URL(requestedDeliveries.deliveries[1]?.confirmationUrl ?? '').hash.slice(1),
    ).get('token');
    assert.ok(confirmationToken);
    verificationTokens.push(confirmationToken);

    const secondEmail = `second-${randomUUID()}@example.test`;
    const secondPassword = `Second-${randomBytes(18).toString('base64url')}!`;
    const secondSignUpResponse = await fetch(
      `${baseUrl}/api/auth/sign-up/email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: baseUrl,
        },
        body: JSON.stringify({
          email: secondEmail,
          name: 'Second Verification User',
          password: secondPassword,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const secondCookie = parseSessionCookie(secondSignUpResponse);
    const secondSignUpBody = (await secondSignUpResponse.json()) as {
      user?: { id?: string };
    };
    assert.equal(secondSignUpResponse.status, 200);
    assert.ok(secondSignUpBody.user?.id);
    secondUserId = secondSignUpBody.user.id;

    const wrongSessionResponse = await fetch(
      `${baseUrl}/auth/email-verification/confirm`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: secondCookie.cookie,
        },
        body: JSON.stringify({ token: confirmationToken }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const wrongSessionText = await wrongSessionResponse.text();
    assert.equal(wrongSessionResponse.status, 400);
    assert.deepEqual(JSON.parse(wrongSessionText), {
      statusCode: 400,
      code: 'EMAIL_VERIFICATION_INVALID',
      message: 'This email verification link is invalid or expired.',
    });
    assert.ok(!wrongSessionText.includes(confirmationToken));
    assert.equal(
      await prisma.user.count({
        where: {
          id: { in: [userId, secondUserId] },
          emailVerified: true,
        },
      }),
      0,
    );

    for (const invalidToken of [
      'not-a-jwt',
      `${confirmationToken.slice(0, -1)}x`,
      await createEmailVerificationToken(
        authSecret,
        email,
        undefined,
        -1,
      ),
    ]) {
      verificationTokens.push(invalidToken);
      await assertInvalidVerificationResponse(
        await fetch(`${baseUrl}/auth/email-verification/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: signInCookie.cookie,
          },
          body: JSON.stringify({ token: invalidToken }),
          signal: AbortSignal.timeout(10_000),
        }),
        invalidToken,
      );
    }

    const sessionCountBeforeVerification = await prisma.session.count({
      where: { userId },
    });
    const confirmResponse = await fetch(
      `${baseUrl}/auth/email-verification/confirm`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: signInCookie.cookie,
        },
        body: JSON.stringify({ token: confirmationToken }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    assert.equal(confirmResponse.status, 200);
    assert.deepEqual(await confirmResponse.json(), { status: 'verified' });
    assert.equal(confirmResponse.headers.get('set-cookie'), null);
    assert.equal(confirmResponse.headers.get('cache-control'), 'no-store');
    assert.equal(confirmResponse.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { emailVerified: true },
        })
      ).emailVerified,
      true,
    );
    assert.equal(await prisma.verification.count(), 0);
    assert.equal(
      await prisma.session.count({ where: { userId } }),
      sessionCountBeforeVerification,
    );

    const verifiedMeResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: signInCookie.cookie },
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(verifiedMeResponse.status, 200);
    assert.deepEqual(await verifiedMeResponse.json(), {
      email,
      emailVerified: true,
      id: userId,
      name: 'Runtime Verification User',
    });

    const replayResponse = await fetch(
      `${baseUrl}/auth/email-verification/confirm`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: signInCookie.cookie,
        },
        body: JSON.stringify({ token: confirmationToken }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    assert.equal(replayResponse.status, 200);
    assert.deepEqual(await replayResponse.json(), { status: 'verified' });
    assert.equal(replayResponse.headers.get('set-cookie'), null);
    assert.equal(
      await prisma.session.count({ where: { userId } }),
      sessionCountBeforeVerification,
    );

    const deliveryCountBeforeVerifiedRequest = (
      (await (
        await fetchCapturedVerificationEmails(baseUrl, testHttpSecret)
      ).json()) as { deliveries: unknown[] }
    ).deliveries.length;
    const verifiedRequestResponse = await fetch(
      `${baseUrl}/auth/email-verification/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: signInCookie.cookie,
        },
        body: '{}',
        signal: AbortSignal.timeout(10_000),
      },
    );
    assert.equal(verifiedRequestResponse.status, 202);
    assert.deepEqual(await verifiedRequestResponse.json(), {
      status: 'accepted',
    });
    assert.equal(
      (
        (await (
          await fetchCapturedVerificationEmails(baseUrl, testHttpSecret)
        ).json()) as { deliveries: unknown[] }
      ).deliveries.length,
      deliveryCountBeforeVerifiedRequest,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/auth/email-verification/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: signInCookie.cookie,
          },
          body: '{}',
          signal: AbortSignal.timeout(10_000),
        })
      ).status,
      202,
    );
    const rateLimitedResponse = await fetch(
      `${baseUrl}/auth/email-verification/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: signInCookie.cookie,
        },
        body: '{}',
        signal: AbortSignal.timeout(10_000),
      },
    );
    assert.equal(rateLimitedResponse.status, 429);
    assert.deepEqual(await rateLimitedResponse.json(), {
      statusCode: 429,
      code: 'EMAIL_VERIFICATION_RATE_LIMITED',
      message: 'Too many requests.',
    });

    const signOutResponse = await fetch(`${baseUrl}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: signInCookie.cookie,
        Origin: baseUrl,
      },
      body: '{}',
      signal: AbortSignal.timeout(10_000),
    });
    const signOutText = await signOutResponse.text();

    assert.equal(signOutResponse.status, 200);
    assert.deepEqual(JSON.parse(signOutText), {
      success: true,
    });
    assertSafeResponseBody('sign-out response', signOutText, password, [
      signUpCookie.rawToken,
      signInCookie.rawToken,
    ]);

    assert.equal(
      await prisma.session.findUnique({
        where: {
          token: signInCookie.rawToken,
        },
      }),
      null,
    );

    const revokedMeResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Cookie: signInCookie.cookie,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const revokedMeText = await revokedMeResponse.text();

    assert.equal(revokedMeResponse.status, 401);
    assertSafeResponseBody('revoked /auth/me response', revokedMeText, password, [
      signUpCookie.rawToken,
      signInCookie.rawToken,
    ]);

    const testOnlyRouteResponse = await fetch(`${baseUrl}/__test/echo-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shouldNotBeReachable: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    assert.equal(testOnlyRouteResponse.status, 201);
    assert.ok(!childOutput.includes(password), 'API logs exposed the password.');
    assert.ok(
      !childOutput.includes(secondPassword),
      'API logs exposed the second password.',
    );
    assert.ok(
      !childOutput.includes(testHttpSecret),
      'API logs exposed the test capture secret.',
    );
    assert.ok(
      !childOutput.includes(signUpCookie.rawToken),
      'API logs exposed the sign-up session token.',
    );
    assert.ok(
      !childOutput.includes(signInCookie.rawToken),
      'API logs exposed the sign-in session token.',
    );
    assert.ok(
      !childOutput.includes(signInCookie.cookie),
      'API logs exposed the session cookie.',
    );
    assert.ok(!childOutput.includes(email), 'API logs exposed the canonical email.');
    assert.ok(
      !childOutput.includes('#token='),
      'API logs exposed a verification confirmation URL.',
    );
    for (const verificationToken of verificationTokens) {
      assert.ok(
        !childOutput.includes(verificationToken),
        'API logs exposed a verification token.',
      );
    }
  } finally {
    await stopChild(child);

    const createdUserIds = [userId, secondUserId].filter(
      (id): id is string => typeof id === 'string',
    );
    await prisma.user.deleteMany({
      where: {
        id: { in: createdUserIds },
      },
    });

    assert.equal(
      await prisma.user.count({
        where: {
          id: { in: createdUserIds },
        },
      }),
      0,
    );

    await disconnectPrismaClient();
  }
});
