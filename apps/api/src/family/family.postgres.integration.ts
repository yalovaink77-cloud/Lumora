import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { test } from "node:test";

import {
  disconnectPrismaClient,
  getPrismaClient,
  PrismaFamilyRepository,
} from "@lumora/database";
import { FAMILY_OWNER_ROLE } from "@lumora/family";

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
  const secondEmail = `family-b-${suffix}@example.test`;
  const firstPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const secondPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const authSecret = randomBytes(48).toString("base64url");
  const createdFamilyIds: string[] = [];
  const createdUserIds: string[] = [];
  let childOutput = "";

  const child = spawn("node", ["dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_TRUSTED_ORIGINS: baseUrl,
      BETTER_AUTH_SECRET: authSecret,
      BETTER_AUTH_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
      LUMORA_ENABLE_TEST_HTTP_ROUTES: "false",
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
      secondEmail,
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

    if (createdUserIds.length > 0) {
      await prisma.family.deleteMany({
        where: {
          memberships: {
            some: {
              userId: {
                in: createdUserIds,
              },
            },
          },
        },
      });
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
