import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { test } from 'node:test';

import {
  disconnectPrismaClient,
  getPrismaClient,
} from '@lumora/database';

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

test('real PostgreSQL authentication lifecycle uses and revokes a server-managed session', async () => {
  assertDisposableDatabaseUrl(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;

  const prisma = getPrismaClient();
  const apiPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${apiPort}`;
  const email = `auth-runtime-${randomUUID()}@example.test`;
  const password = `Runtime-${randomBytes(18).toString('base64url')}!`;
  const authSecret = randomBytes(48).toString('base64url');
  let childOutput = '';
  let userId: string | undefined;

  const child = spawn('node', ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_TRUSTED_ORIGINS: baseUrl,
      BETTER_AUTH_SECRET: authSecret,
      BETTER_AUTH_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
      LUMORA_ENABLE_TEST_HTTP_ROUTES: 'false',
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
        email,
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
      id: userId,
      name: 'Runtime Verification User',
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

    assert.equal(testOnlyRouteResponse.status, 404);
    assert.ok(!childOutput.includes(password), 'API logs exposed the password.');
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
  } finally {
    await stopChild(child);

    await prisma.user.deleteMany({
      where: {
        email,
      },
    });

    assert.equal(
      await prisma.user.count({
        where: {
          email,
        },
      }),
      0,
    );

    await disconnectPrismaClient();
  }
});
