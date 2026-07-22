import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { test } from "node:test";

import {
  disconnectPrismaClient,
  getPrismaClient,
  PrismaFamilyRepository,
} from "@lumora/database";
import { preflightCanonicalUserEmails } from "@lumora/auth";
import { FAMILY_MEMBER_ROLE, FAMILY_OWNER_ROLE } from "@lumora/family";

const testDatabaseUrl = process.env.AUTH_TEST_DATABASE_URL;

function assertDisposableDatabaseUrl(
  databaseUrl: string | undefined,
): asserts databaseUrl is string {
  assert.ok(
    databaseUrl,
    "AUTH_TEST_DATABASE_URL is required. Run through pnpm test:family:postgres.",
  );

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");

  assert.ok(
    ["127.0.0.1", "localhost"].includes(parsed.hostname),
    "The Family runtime test only accepts local disposable PostgreSQL.",
  );
  assert.match(
    databaseName,
    /test/i,
    "The database name must identify a test database.",
  );
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to resolve an available API port."));
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
): Promise<void> {
  const timeoutAt = Date.now() + 20_000;

  while (Date.now() < timeoutAt) {
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

  child.kill("SIGTERM");

  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5_000);
    }),
  ]);
}

function sessionCookie(response: Response): {
  cookie: string;
  rawToken: string;
} {
  const setCookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("better-auth.session_token="));

  assert.ok(setCookie);
  const cookie = setCookie.split(";", 1)[0];
  assert.ok(cookie);
  const signedValue = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
  const rawToken = signedValue.split(".", 1)[0];
  assert.ok(rawToken);

  return {
    cookie,
    rawToken,
  };
}

async function registerUser(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
): Promise<{ cookie: string; rawToken: string; userId: string }> {
  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({
      email,
      name,
      password,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const cookie = sessionCookie(response);
  const body = (await response.json()) as {
    user?: {
      id?: string;
    };
  };

  assert.equal(response.status, 200);
  assert.ok(body.user?.id);

  return {
    ...cookie,
    userId: body.user.id,
  };
}

async function createFamily(
  baseUrl: string,
  cookie: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${baseUrl}/families`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

async function requestJson(
  baseUrl: string,
  path: string,
  cookie: string,
  options: { method?: string; body?: unknown } = {},
  // Test responses intentionally span unrelated API contracts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ response: Response; text: string; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...(options.method === undefined ? {} : { method: options.method }),
    headers: {
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      Cookie: cookie,
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  return {
    response,
    text,
    body: text ? JSON.parse(text) : undefined,
  };
}

async function verificationTokensByRecipient(
  baseUrl: string,
  testHttpSecret: string,
): Promise<Map<string, string>> {
  const response = await fetch(
    `${baseUrl}/__test/email-verification-deliveries`,
    {
      headers: { "x-lumora-test-secret": testHttpSecret },
      signal: AbortSignal.timeout(10_000),
    },
  );
  const body = (await response.json()) as {
    deliveries: Array<{ confirmationUrl: string; recipient: string }>;
  };
  assert.equal(response.status, 200);

  return new Map(
    body.deliveries.map((delivery) => {
      const token = new URLSearchParams(
        new URL(delivery.confirmationUrl).hash.slice(1),
      ).get("token");
      assert.ok(token);
      return [delivery.recipient, token];
    }),
  );
}

async function confirmEmail(
  baseUrl: string,
  cookie: string,
  token: string,
): Promise<void> {
  const result = await requestJson(
    baseUrl,
    "/auth/email-verification/confirm",
    cookie,
    { method: "POST", body: { token } },
  );
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { status: "verified" });
}

function secretDigest(secret: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(createHash("sha256").update(secret).digest());
}

function assertFamilyShape(value: unknown): asserts value is {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
} {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value), [
    "id",
    "displayName",
    "createdAt",
    "updatedAt",
  ]);
}

test("Family runtime enforces atomic ownership and cross-family isolation", async () => {
  assertDisposableDatabaseUrl(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;

  const prisma = getPrismaClient();
  const repository = new PrismaFamilyRepository();
  const apiPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${apiPort}`;
  const suffix = randomUUID();
  const firstEmail = `family-a-${suffix}@example.test`;
  const secondSubmittedEmail = `Family-B-${suffix}@Example.Test`;
  const secondEmail = secondSubmittedEmail.toLowerCase();
  const firstPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const secondPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const authSecret = randomBytes(48).toString("base64url");
  const testHttpSecret = randomBytes(32).toString("base64url");
  const createdFamilyIds: string[] = [];
  const createdUserIds: string[] = [];
  let childOutput = "";

  await preflightCanonicalUserEmails();

  const child = spawn("node", ["dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_TRUSTED_ORIGINS: baseUrl,
      AUTH_EMAIL_VERIFICATION_DELIVERY_MODE: "capture",
      AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL: `${baseUrl}/verify-email`,
      BETTER_AUTH_SECRET: authSecret,
      BETTER_AUTH_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
      LUMORA_ENABLE_TEST_HTTP_ROUTES: "true",
      LUMORA_TEST_HTTP_SECRET: testHttpSecret,
      NODE_ENV: "test",
      PORT: String(apiPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    childOutput += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    childOutput += chunk.toString();
  });

  try {
    await waitForServerReady(baseUrl, () => childOutput);

    const unauthenticatedRequests = [
      fetch(`${baseUrl}/families`),
      fetch(`${baseUrl}/families/unknown-family`),
      createFamily(baseUrl, "", {
        displayName: "Unauthorized Family",
      }),
    ];

    for (const response of await Promise.all(unauthenticatedRequests)) {
      assert.equal(response.status, 401);
    }

    const firstUser = await registerUser(
      baseUrl,
      firstEmail,
      "First Family User",
      firstPassword,
    );
    createdUserIds.push(firstUser.userId);
    const secondUser = await registerUser(
      baseUrl,
      secondSubmittedEmail,
      "Second Family User",
      secondPassword,
    );
    createdUserIds.push(secondUser.userId);

    const invalidCases = [
      [{}, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: "" }, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: " \t " }, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: "a".repeat(101) }, "DISPLAY_NAME_TOO_LONG"],
      [{ displayName: "Family", role: "OWNER" }, "UNKNOWN_FIELD"],
      [{ displayName: "Family", userId: secondUser.userId }, "UNKNOWN_FIELD"],
    ] as const;

    for (const [body, code] of invalidCases) {
      const response = await createFamily(baseUrl, firstUser.cookie, body);
      const responseBody = (await response.json()) as {
        code?: string;
      };

      assert.equal(response.status, 400);
      assert.equal(responseBody.code, code);
    }

    const firstCreateResponse = await createFamily(baseUrl, firstUser.cookie, {
      displayName: "  Yıldız Ailesi 🌿  ",
    });
    const firstCreateText = await firstCreateResponse.text();
    const firstCreated = JSON.parse(firstCreateText) as {
      family: {
        id: string;
        displayName: string;
        createdAt: string;
        updatedAt: string;
      };
      membership: {
        id: string;
        familyId: string;
        userId: string;
        role: string;
        createdAt: string;
        updatedAt: string;
      };
    };

    assert.equal(firstCreateResponse.status, 201);
    assertFamilyShape(firstCreated.family);
    assert.equal(firstCreated.family.displayName, "Yıldız Ailesi 🌿");
    assert.deepEqual(Object.keys(firstCreated.membership), [
      "id",
      "familyId",
      "userId",
      "role",
      "createdAt",
      "updatedAt",
    ]);
    assert.equal(firstCreated.membership.familyId, firstCreated.family.id);
    assert.equal(firstCreated.membership.userId, firstUser.userId);
    assert.equal(firstCreated.membership.role, FAMILY_OWNER_ROLE);
    createdFamilyIds.push(firstCreated.family.id);

    const duplicateNameResponse = await createFamily(
      baseUrl,
      firstUser.cookie,
      {
        displayName: "Yıldız Ailesi 🌿",
      },
    );
    const duplicateNameCreated = (await duplicateNameResponse.json()) as {
      family: { id: string; displayName: string };
    };

    assert.equal(duplicateNameResponse.status, 201);
    assert.equal(duplicateNameCreated.family.displayName, "Yıldız Ailesi 🌿");
    assert.notEqual(duplicateNameCreated.family.id, firstCreated.family.id);
    createdFamilyIds.push(duplicateNameCreated.family.id);

    const maximumName = "🌿".repeat(100);
    const maximumNameResponse = await createFamily(baseUrl, firstUser.cookie, {
      displayName: maximumName,
    });
    const maximumNameCreated = (await maximumNameResponse.json()) as {
      family: { id: string; displayName: string };
    };

    assert.equal(maximumNameResponse.status, 201);
    assert.equal(maximumNameCreated.family.displayName, maximumName);
    createdFamilyIds.push(maximumNameCreated.family.id);

    const secondCreateResponse = await createFamily(
      baseUrl,
      secondUser.cookie,
      {
        displayName: "Second Private Family",
      },
    );
    const secondCreated = (await secondCreateResponse.json()) as {
      family: { id: string; displayName: string };
    };

    assert.equal(secondCreateResponse.status, 201);
    createdFamilyIds.push(secondCreated.family.id);

    const firstListResponse = await fetch(`${baseUrl}/families`, {
      headers: {
        Cookie: firstUser.cookie,
      },
    });
    const firstList = (await firstListResponse.json()) as {
      families: {
        id: string;
        displayName: string;
        createdAt: string;
        updatedAt: string;
      }[];
    };

    assert.equal(firstListResponse.status, 200);
    assert.equal(firstList.families.length, 3);
    assert.deepEqual(
      new Set(firstList.families.map((family) => family.id)),
      new Set(createdFamilyIds.slice(0, 3)),
    );
    firstList.families.forEach(assertFamilyShape);

    const secondListResponse = await fetch(`${baseUrl}/families`, {
      headers: {
        Cookie: secondUser.cookie,
      },
    });
    const secondList = (await secondListResponse.json()) as {
      families: {
        id: string;
        displayName: string;
        createdAt: string;
        updatedAt: string;
      }[];
    };

    assert.equal(secondListResponse.status, 200);
    assert.equal(secondList.families.length, 1);
    assertFamilyShape(secondList.families[0]);
    assert.equal(secondList.families[0]?.id, secondCreated.family.id);
    assert.equal(secondList.families[0]?.displayName, "Second Private Family");

    const firstGetResponse = await fetch(
      `${baseUrl}/families/${firstCreated.family.id}`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const firstGet = await firstGetResponse.json();

    assert.equal(firstGetResponse.status, 200);
    assertFamilyShape(firstGet);
    assert.deepEqual(firstGet, firstCreated.family);

    const inaccessibleResponse = await fetch(
      `${baseUrl}/families/${firstCreated.family.id}`,
      {
        headers: {
          Cookie: secondUser.cookie,
        },
      },
    );
    const unknownResponse = await fetch(`${baseUrl}/families/${randomUUID()}`, {
      headers: {
        Cookie: secondUser.cookie,
      },
    });
    const inaccessibleBody = await inaccessibleResponse.text();
    const unknownBody = await unknownResponse.text();

    assert.equal(inaccessibleResponse.status, 404);
    assert.equal(unknownResponse.status, 404);
    assert.equal(inaccessibleBody, unknownBody);

    const firstMemberships = await prisma.familyMembership.findMany({
      where: {
        familyId: firstCreated.family.id,
      },
    });

    assert.equal(firstMemberships.length, 1);
    assert.equal(firstMemberships[0]?.userId, firstUser.userId);
    assert.equal(firstMemberships[0]?.role, FAMILY_OWNER_ROLE);

    const invalidCreationCases = [
      [{ email: secondEmail, extra: true }, "UNKNOWN_FIELD"],
      [{ extra: true }, "UNKNOWN_FIELD"],
      [{}, "EMAIL_REQUIRED"],
      [{ email: "not-an-email" }, "EMAIL_INVALID"],
      [{ email: ` ${secondEmail}` }, "EMAIL_INVALID"],
    ] as const;

    for (const [body, code] of invalidCreationCases) {
      const result = await requestJson(
        baseUrl,
        `/families/${randomUUID()}/invitations`,
        firstUser.cookie,
        { method: "POST", body },
      );
      assert.equal(result.response.status, 400);
      assert.deepEqual(result.body, {
        statusCode: 400,
        code,
        message: "Invalid Family invitation request.",
      });
      assert.ok(!result.text.includes(secondEmail));
    }

    const invitationCreation = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/invitations`,
      firstUser.cookie,
      { method: "POST", body: { email: secondSubmittedEmail } },
    );
    assert.equal(invitationCreation.response.status, 201);
    assert.deepEqual(Object.keys(invitationCreation.body), [
      "invitation",
      "invitationSecret",
    ]);
    assert.deepEqual(Object.keys(invitationCreation.body.invitation), [
      "id",
      "familyId",
      "role",
      "expiresAt",
      "createdAt",
    ]);
    assert.equal(
      invitationCreation.body.invitation.familyId,
      firstCreated.family.id,
    );
    assert.equal(invitationCreation.body.invitation.role, FAMILY_MEMBER_ROLE);
    const invitationSecret = invitationCreation.body.invitationSecret as string;
    assert.match(invitationSecret, /^[A-Za-z0-9_-]{43}$/);
    assert.doesNotMatch(
      invitationCreation.text,
      /targetEmail|inviter|secretHash|digest/i,
    );

    const persistedInvitation = await prisma.familyInvitation.findUniqueOrThrow(
      {
        where: { id: invitationCreation.body.invitation.id as string },
      },
    );
    assert.equal(persistedInvitation.targetEmailNormalized, secondEmail);
    assert.equal(persistedInvitation.role, FAMILY_MEMBER_ROLE);
    assert.equal(persistedInvitation.secretHash.byteLength, 32);
    assert.deepEqual(
      persistedInvitation.secretHash,
      secretDigest(invitationSecret),
    );
    assert.ok(
      !JSON.stringify(persistedInvitation).includes(invitationSecret),
      "The invitation row persisted the raw secret.",
    );
    assert.equal(
      persistedInvitation.expiresAt.getTime() -
        persistedInvitation.createdAt.getTime(),
      7 * 24 * 60 * 60 * 1000,
    );
    assert.equal(
      await prisma.familyMembership.count({
        where: { familyId: firstCreated.family.id, userId: secondUser.userId },
      }),
      0,
    );

    const duplicateInvitation = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/invitations`,
      firstUser.cookie,
      { method: "POST", body: { email: secondEmail } },
    );
    assert.equal(duplicateInvitation.response.status, 409);
    assert.deepEqual(duplicateInvitation.body, {
      statusCode: 409,
      code: "INVITATION_ALREADY_PENDING",
      message: "A pending invitation already exists.",
    });
    assert.equal(
      (duplicateInvitation.body as Record<string, unknown>).invitationSecret,
      undefined,
    );

    const concurrentInviteEmail = `concurrent-create-${suffix}@example.test`;
    const concurrentCreateResults = await Promise.all([
      requestJson(
        baseUrl,
        `/families/${firstCreated.family.id}/invitations`,
        firstUser.cookie,
        { method: "POST", body: { email: concurrentInviteEmail } },
      ),
      requestJson(
        baseUrl,
        `/families/${firstCreated.family.id}/invitations`,
        firstUser.cookie,
        { method: "POST", body: { email: concurrentInviteEmail } },
      ),
    ]);
    const concurrentCreateStatuses = concurrentCreateResults
      .map((result) => result.response.status)
      .sort();
    assert.deepEqual(concurrentCreateStatuses, [201, 409]);
    const concurrentCreated = concurrentCreateResults.find(
      (result) => result.response.status === 201,
    );
    const concurrentConflict = concurrentCreateResults.find(
      (result) => result.response.status === 409,
    );
    assert.ok(concurrentCreated);
    assert.ok(concurrentConflict);
    assert.equal(
      (concurrentConflict.body as Record<string, unknown>).invitationSecret,
      undefined,
    );
    assert.equal(
      await prisma.familyInvitation.count({
        where: {
          familyId: firstCreated.family.id,
          targetEmailNormalized: concurrentInviteEmail,
          consumedAt: null,
        },
      }),
      1,
    );

    const nonexistentEmail = `no-account-${suffix}@example.test`;
    const noAccountInvitation = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/invitations`,
      firstUser.cookie,
      { method: "POST", body: { email: nonexistentEmail } },
    );
    assert.equal(noAccountInvitation.response.status, 201);
    assert.equal(
      await prisma.user.count({ where: { email: nonexistentEmail } }),
      0,
    );
    assert.equal(
      (
        await prisma.familyInvitation.findUniqueOrThrow({
          where: { id: noAccountInvitation.body.invitation.id as string },
        })
      ).targetEmailNormalized,
      nonexistentEmail,
    );

    const unverifiedAcceptance = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      secondUser.cookie,
      { method: "POST", body: { invitationSecret } },
    );
    assert.equal(unverifiedAcceptance.response.status, 403);
    assert.deepEqual(unverifiedAcceptance.body, {
      statusCode: 403,
      code: "VERIFIED_EMAIL_REQUIRED",
      message: "Verified email is required.",
    });
    const unverifiedUnknownAcceptance = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      secondUser.cookie,
      {
        method: "POST",
        body: { invitationSecret: randomBytes(32).toString("base64url") },
      },
    );
    assert.deepEqual(
      unverifiedUnknownAcceptance.body,
      unverifiedAcceptance.body,
    );
    assert.equal(persistedInvitation.consumedAt, null);

    const verificationTokens = await verificationTokensByRecipient(
      baseUrl,
      testHttpSecret,
    );
    assert.equal(verificationTokens.size, 2);
    const firstVerificationToken = verificationTokens.get(firstEmail);
    const secondVerificationToken = verificationTokens.get(secondEmail);
    assert.ok(firstVerificationToken);
    assert.ok(secondVerificationToken);
    await confirmEmail(baseUrl, firstUser.cookie, firstVerificationToken);
    await confirmEmail(baseUrl, secondUser.cookie, secondVerificationToken);
    await preflightCanonicalUserEmails();
    assert.deepEqual(
      await prisma.user.findMany({
        where: { id: { in: [firstUser.userId, secondUser.userId] } },
        orderBy: { email: "asc" },
        select: { email: true, emailVerified: true },
      }),
      [
        { email: firstEmail, emailVerified: true },
        { email: secondEmail, emailVerified: true },
      ].sort((left, right) => left.email.localeCompare(right.email)),
    );

    const acceptanceValidationCases = [
      [{ invitationSecret, extra: true }, 400, "UNKNOWN_FIELD"],
      [{ extra: true }, 400, "UNKNOWN_FIELD"],
      [{}, 400, "INVITATION_SECRET_REQUIRED"],
      [{ invitationSecret: "x".repeat(42) }, 400, "INVITATION_SECRET_INVALID"],
    ] as const;
    for (const [body, status, code] of acceptanceValidationCases) {
      const result = await requestJson(
        baseUrl,
        "/family-invitations/accept",
        secondUser.cookie,
        { method: "POST", body },
      );
      assert.equal(result.response.status, status);
      assert.deepEqual(result.body, {
        statusCode: status,
        code,
        message: "Invalid Family invitation acceptance request.",
      });
      assert.ok(!result.text.includes(invitationSecret));
    }

    const unknownSecretResult = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      secondUser.cookie,
      {
        method: "POST",
        body: { invitationSecret: randomBytes(32).toString("base64url") },
      },
    );
    const wrongEmailResult = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      firstUser.cookie,
      { method: "POST", body: { invitationSecret } },
    );
    for (const result of [unknownSecretResult, wrongEmailResult]) {
      assert.equal(result.response.status, 404);
      assert.deepEqual(result.body, {
        statusCode: 404,
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found.",
      });
    }

    const ownerMembership = firstMemberships[0];
    assert.ok(ownerMembership);
    const expiredSecret = randomBytes(32).toString("base64url");
    const expiredCreatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.familyInvitation.create({
      data: {
        familyId: firstCreated.family.id,
        inviterMembershipId: ownerMembership.id,
        targetEmailNormalized: secondEmail,
        role: FAMILY_MEMBER_ROLE,
        secretHash: secretDigest(expiredSecret),
        createdAt: expiredCreatedAt,
        updatedAt: expiredCreatedAt,
        expiresAt: new Date(
          expiredCreatedAt.getTime() + 7 * 24 * 60 * 60 * 1000,
        ),
      },
    });
    const expiredResult = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      secondUser.cookie,
      { method: "POST", body: { invitationSecret: expiredSecret } },
    );
    assert.equal(expiredResult.response.status, 404);
    assert.deepEqual(expiredResult.body, unknownSecretResult.body);

    const accepted = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      secondUser.cookie,
      { method: "POST", body: { invitationSecret } },
    );
    assert.equal(accepted.response.status, 200);
    assert.deepEqual(Object.keys(accepted.body), ["family", "membership"]);
    assert.deepEqual(accepted.body.family, firstCreated.family);
    assert.equal(accepted.body.membership.familyId, firstCreated.family.id);
    assert.equal(accepted.body.membership.userId, secondUser.userId);
    assert.equal(accepted.body.membership.role, FAMILY_MEMBER_ROLE);
    assert.doesNotMatch(
      accepted.text,
      /email|inviter|invitationSecret|secretHash|digest/i,
    );
    const consumedInvitation = await prisma.familyInvitation.findUniqueOrThrow({
      where: { id: persistedInvitation.id },
    });
    assert.ok(consumedInvitation.consumedAt);
    assert.equal(consumedInvitation.acceptedByUserId, secondUser.userId);
    assert.equal(
      await prisma.familyMembership.count({
        where: { familyId: firstCreated.family.id, userId: secondUser.userId },
      }),
      1,
    );

    const replay = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      secondUser.cookie,
      { method: "POST", body: { invitationSecret } },
    );
    assert.equal(replay.response.status, 200);
    assert.deepEqual(replay.body, accepted.body);

    // Keep expiresAt > createdAt (CHECK) while still forcing a past expiry.
    const forcedCreatedAt = new Date(Date.now() - 120_000);
    await prisma.familyInvitation.update({
      where: { id: persistedInvitation.id },
      data: {
        createdAt: forcedCreatedAt,
        expiresAt: new Date(forcedCreatedAt.getTime() + 60_000),
      },
    });
    const replayAfterExpiry = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      secondUser.cookie,
      { method: "POST", body: { invitationSecret } },
    );
    assert.equal(replayAfterExpiry.response.status, 200);
    assert.deepEqual(replayAfterExpiry.body, accepted.body);

    const differentUserReplay = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      firstUser.cookie,
      { method: "POST", body: { invitationSecret } },
    );
    assert.equal(differentUserReplay.response.status, 404);
    assert.deepEqual(differentUserReplay.body, unknownSecretResult.body);

    const concurrentCreation = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/invitations`,
      firstUser.cookie,
      { method: "POST", body: { email: secondEmail } },
    );
    assert.equal(concurrentCreation.response.status, 201);
    const concurrentSecret = concurrentCreation.body.invitationSecret as string;
    const concurrentAcceptances = await Promise.all([
      requestJson(baseUrl, "/family-invitations/accept", secondUser.cookie, {
        method: "POST",
        body: { invitationSecret: concurrentSecret },
      }),
      requestJson(baseUrl, "/family-invitations/accept", secondUser.cookie, {
        method: "POST",
        body: { invitationSecret: concurrentSecret },
      }),
    ]);
    assert.deepEqual(
      concurrentAcceptances.map((result) => result.response.status),
      [200, 200],
    );
    assert.deepEqual(
      concurrentAcceptances[0]?.body,
      concurrentAcceptances[1]?.body,
    );
    assert.equal(
      await prisma.familyMembership.count({
        where: { familyId: firstCreated.family.id, userId: secondUser.userId },
      }),
      1,
    );

    const ownerSelfInvitation = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/invitations`,
      firstUser.cookie,
      { method: "POST", body: { email: firstEmail } },
    );
    assert.equal(ownerSelfInvitation.response.status, 201);
    const ownerSelfAcceptance = await requestJson(
      baseUrl,
      "/family-invitations/accept",
      firstUser.cookie,
      {
        method: "POST",
        body: {
          invitationSecret: ownerSelfInvitation.body.invitationSecret,
        },
      },
    );
    assert.equal(ownerSelfAcceptance.response.status, 200);
    assert.equal(ownerSelfAcceptance.body.membership.id, ownerMembership.id);
    assert.equal(ownerSelfAcceptance.body.membership.role, FAMILY_OWNER_ROLE);

    const memberInvite = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/invitations`,
      secondUser.cookie,
      { method: "POST", body: { email: `other-${suffix}@example.test` } },
    );
    const unknownFamilyInvite = await requestJson(
      baseUrl,
      `/families/${randomUUID()}/invitations`,
      firstUser.cookie,
      { method: "POST", body: { email: `other-${suffix}@example.test` } },
    );
    assert.equal(memberInvite.response.status, 404);
    assert.deepEqual(memberInvite.body, unknownFamilyInvite.body);
    assert.deepEqual(memberInvite.body, {
      statusCode: 404,
      code: "FAMILY_NOT_FOUND",
      message: "Family not found.",
    });

    const memberFamilyList = await requestJson(
      baseUrl,
      "/families",
      secondUser.cookie,
    );
    assert.equal(memberFamilyList.response.status, 200);
    assert.ok(
      memberFamilyList.body.families.some(
        (family: { id: string }) => family.id === firstCreated.family.id,
      ),
    );
    const memberFamilyGet = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}`,
      secondUser.cookie,
    );
    assert.equal(memberFamilyGet.response.status, 200);

    const pregnancyCreated = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/pregnancies`,
      secondUser.cookie,
      { method: "POST", body: { displayName: "Member Pregnancy" } },
    );
    assert.equal(pregnancyCreated.response.status, 201);
    for (const path of [
      `/families/${firstCreated.family.id}/pregnancies`,
      `/families/${firstCreated.family.id}/pregnancies/${pregnancyCreated.body.id}`,
    ]) {
      assert.equal(
        (await requestJson(baseUrl, path, secondUser.cookie)).response.status,
        200,
      );
    }

    const childCreated = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/children`,
      secondUser.cookie,
      { method: "POST", body: { displayName: "Member Child" } },
    );
    assert.equal(childCreated.response.status, 201);
    for (const path of [
      `/families/${firstCreated.family.id}/children`,
      `/families/${firstCreated.family.id}/children/${childCreated.body.id}`,
    ]) {
      assert.equal(
        (await requestJson(baseUrl, path, secondUser.cookie)).response.status,
        200,
      );
    }
    const childUpdated = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/children/${childCreated.body.id}`,
      secondUser.cookie,
      { method: "PATCH", body: { displayName: "Member Updated Child" } },
    );
    assert.equal(childUpdated.response.status, 200);
    assert.equal(childUpdated.body.displayName, "Member Updated Child");

    for (const subject of [
      { collection: "pregnancies", id: pregnancyCreated.body.id as string },
      { collection: "children", id: childCreated.body.id as string },
    ]) {
      const timelinePath = `/families/${firstCreated.family.id}/${subject.collection}/${subject.id}/timeline-events`;
      const timelineCreated = await requestJson(
        baseUrl,
        timelinePath,
        secondUser.cookie,
        {
          method: "POST",
          body: {
            title: `Member ${subject.collection} event`,
            occurredAt: "2026-07-22T10:00:00.000Z",
          },
        },
      );
      assert.equal(timelineCreated.response.status, 201);
      assert.equal(
        (await requestJson(baseUrl, timelinePath, secondUser.cookie)).response
          .status,
        200,
      );
      assert.equal(
        (
          await requestJson(
            baseUrl,
            `${timelinePath}/${timelineCreated.body.id}`,
            secondUser.cookie,
          )
        ).response.status,
        200,
      );
    }

    const ownerRegression = await requestJson(
      baseUrl,
      `/families/${firstCreated.family.id}/pregnancies`,
      firstUser.cookie,
    );
    assert.equal(ownerRegression.response.status, 200);

    const constraintUserId = `constraint-${suffix}`;
    await prisma.user.create({
      data: {
        id: constraintUserId,
        email: `constraint-${suffix}@example.test`,
        name: "Constraint User",
        emailVerified: true,
      },
    });
    createdUserIds.push(constraintUserId);
    await assert.rejects(() =>
      prisma.familyMembership.create({
        data: {
          familyId: firstCreated.family.id,
          userId: constraintUserId,
          role: FAMILY_OWNER_ROLE,
        },
      }),
    );

    const secondFamilyOwnerMembership =
      await prisma.familyMembership.findFirstOrThrow({
        where: {
          familyId: duplicateNameCreated.family.id,
          userId: firstUser.userId,
        },
      });
    const invalidInvitationBase = {
      familyId: firstCreated.family.id,
      inviterMembershipId: ownerMembership.id,
      targetEmailNormalized: `constraint-target-${suffix}@example.test`,
      role: FAMILY_MEMBER_ROLE,
      expiresAt: new Date(Date.now() + 60_000),
    } as const;
    await assert.rejects(() =>
      prisma.familyInvitation.create({
        data: {
          ...invalidInvitationBase,
          inviterMembershipId: secondFamilyOwnerMembership.id,
          secretHash: randomBytes(32),
        },
      }),
    );
    await assert.rejects(() =>
      prisma.familyInvitation.create({
        data: {
          ...invalidInvitationBase,
          role: FAMILY_OWNER_ROLE,
          secretHash: randomBytes(32),
        },
      }),
    );
    await assert.rejects(() =>
      prisma.familyInvitation.create({
        data: { ...invalidInvitationBase, secretHash: randomBytes(31) },
      }),
    );
    await assert.rejects(() =>
      prisma.familyInvitation.create({
        data: {
          ...invalidInvitationBase,
          secretHash: randomBytes(32),
          acceptedByUserId: secondUser.userId,
        },
      }),
    );
    await assert.rejects(() =>
      prisma.familyInvitation.create({
        data: {
          ...invalidInvitationBase,
          secretHash: randomBytes(32),
          createdAt: new Date(Date.now() + 120_000),
        },
      }),
    );
    await assert.rejects(() =>
      prisma.family.delete({ where: { id: firstCreated.family.id } }),
    );
    await assert.rejects(() =>
      prisma.familyMembership.delete({ where: { id: ownerMembership.id } }),
    );

    for (const sensitive of [
      firstEmail,
      secondEmail,
      nonexistentEmail,
      concurrentInviteEmail,
      invitationSecret,
      concurrentSecret,
      concurrentCreated.body.invitationSecret as string,
      ownerSelfInvitation.body.invitationSecret as string,
      Buffer.from(persistedInvitation.secretHash).toString("hex"),
    ]) {
      assert.ok(
        !childOutput.includes(sensitive),
        `API logs exposed ${sensitive}.`,
      );
    }

    await assert.rejects(() =>
      prisma.familyMembership.create({
        data: {
          familyId: firstCreated.family.id,
          role: FAMILY_OWNER_ROLE,
          userId: firstUser.userId,
        },
      }),
    );
    assert.equal(
      await prisma.familyMembership.count({
        where: {
          familyId: firstCreated.family.id,
          userId: firstUser.userId,
        },
      }),
      1,
    );

    const rollbackDisplayName = `Rollback ${suffix}`;

    await assert.rejects(() =>
      repository.createFamilyWithMembership({
        displayName: rollbackDisplayName,
        role: FAMILY_OWNER_ROLE,
        userId: `missing-user-${suffix}`,
      }),
    );
    assert.equal(
      await prisma.family.count({
        where: {
          displayName: rollbackDisplayName,
        },
      }),
      0,
    );

    await assert.rejects(() =>
      prisma.user.delete({
        where: {
          id: firstUser.userId,
        },
      }),
    );
    assert.ok(
      await prisma.family.findUnique({
        where: {
          id: firstCreated.family.id,
        },
      }),
    );

    assert.equal(
      await prisma.familyMembership.count({
        where: {
          userId: firstUser.userId,
        },
      }),
      3,
    );
    assert.equal(
      await prisma.family.count({
        where: {
          displayName: "Yıldız Ailesi 🌿",
        },
      }),
      2,
    );

    for (const responseText of [
      firstCreateText,
      JSON.stringify(firstList),
      JSON.stringify(firstGet),
    ]) {
      assert.ok(!responseText.includes(firstPassword));
      assert.ok(!responseText.includes(firstUser.rawToken));
      assert.doesNotMatch(
        responseText,
        /"email"|"name"|"token"|"session"|"account"/,
      );
    }

    assert.ok(!childOutput.includes(firstPassword));
    assert.ok(!childOutput.includes(secondPassword));
    assert.ok(!childOutput.includes(firstUser.rawToken));
    assert.ok(!childOutput.includes(secondUser.rawToken));
  } finally {
    await stopChild(child);

    if (createdFamilyIds.length > 0) {
      await prisma.familyInvitation.deleteMany({
        where: { familyId: { in: createdFamilyIds } },
      });
      await prisma.timelineEvent.deleteMany({
        where: { familyId: { in: createdFamilyIds } },
      });
      await prisma.child.deleteMany({
        where: { familyId: { in: createdFamilyIds } },
      });
      await prisma.pregnancy.deleteMany({
        where: { familyId: { in: createdFamilyIds } },
      });
      await prisma.familyMembership.deleteMany({
        where: { familyId: { in: createdFamilyIds } },
      });
      await prisma.family.deleteMany({
        where: { id: { in: createdFamilyIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: createdUserIds,
          },
        },
      });
    }

    assert.equal(
      await prisma.family.count({
        where: {
          id: {
            in: createdFamilyIds,
          },
        },
      }),
      0,
    );
    await disconnectPrismaClient();
  }
});
