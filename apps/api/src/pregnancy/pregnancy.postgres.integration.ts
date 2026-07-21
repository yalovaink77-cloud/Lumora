import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { test } from "node:test";

import {
  disconnectPrismaClient,
  getPrismaClient,
  PrismaPregnancyRepository,
} from "@lumora/database";

const testDatabaseUrl = process.env.AUTH_TEST_DATABASE_URL;

function assertDisposableDatabaseUrl(
  databaseUrl: string | undefined,
): asserts databaseUrl is string {
  assert.ok(
    databaseUrl,
    "AUTH_TEST_DATABASE_URL is required. Run through pnpm test:pregnancy:postgres.",
  );

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");

  assert.ok(
    ["127.0.0.1", "localhost"].includes(parsed.hostname),
    "The Pregnancy runtime test only accepts local disposable PostgreSQL.",
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
  displayName: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/families`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      displayName,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json()) as {
    family?: {
      id?: string;
    };
  };

  assert.equal(response.status, 201);
  assert.ok(body.family?.id);
  return body.family.id;
}

async function createPregnancy(
  baseUrl: string,
  familyId: string,
  cookie: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${baseUrl}/families/${familyId}/pregnancies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

function assertPregnancyShape(value: unknown): asserts value is {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
} {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value), [
    "id",
    "familyId",
    "displayName",
    "createdAt",
    "updatedAt",
  ]);
}

test("Pregnancy runtime enforces validation, scoped authorization, and isolation", async () => {
  assertDisposableDatabaseUrl(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;

  const prisma = getPrismaClient();
  const repository = new PrismaPregnancyRepository();
  const apiPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${apiPort}`;
  const suffix = randomUUID();
  const firstEmail = `pregnancy-a-${suffix}@example.test`;
  const secondEmail = `pregnancy-b-${suffix}@example.test`;
  const firstPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const secondPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const authSecret = randomBytes(48).toString("base64url");
  const createdFamilyIds: string[] = [];
  const createdPregnancyIds: string[] = [];
  const createdUserIds: string[] = [];
  const sensitiveResponseTexts: string[] = [];
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

    const unknownFamilyId = randomUUID();
    const unauthenticatedRequests = [
      createPregnancy(baseUrl, unknownFamilyId, "", {
        displayName: "Unauthorized",
      }),
      fetch(`${baseUrl}/families/${unknownFamilyId}/pregnancies`),
      fetch(
        `${baseUrl}/families/${unknownFamilyId}/pregnancies/${randomUUID()}`,
      ),
    ];

    for (const response of await Promise.all(unauthenticatedRequests)) {
      assert.equal(response.status, 401);
    }

    const firstUser = await registerUser(
      baseUrl,
      firstEmail,
      "First Pregnancy User",
      firstPassword,
    );
    createdUserIds.push(firstUser.userId);
    const secondUser = await registerUser(
      baseUrl,
      secondEmail,
      "Second Pregnancy User",
      secondPassword,
    );
    createdUserIds.push(secondUser.userId);

    const firstFamilyId = await createFamily(
      baseUrl,
      firstUser.cookie,
      "First Family",
    );
    createdFamilyIds.push(firstFamilyId);
    const otherFirstUserFamilyId = await createFamily(
      baseUrl,
      firstUser.cookie,
      "Other First User Family",
    );
    createdFamilyIds.push(otherFirstUserFamilyId);
    const secondFamilyId = await createFamily(
      baseUrl,
      secondUser.cookie,
      "Second Family",
    );
    createdFamilyIds.push(secondFamilyId);

    const invalidCases = [
      [{}, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: 42 }, "DISPLAY_NAME_INVALID"],
      [{ displayName: "" }, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: " \t " }, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: "🌿".repeat(101) }, "DISPLAY_NAME_TOO_LONG"],
      [{ displayName: "Journey", familyId: secondFamilyId }, "UNKNOWN_FIELD"],
      [{ displayName: "Journey", userId: secondUser.userId }, "UNKNOWN_FIELD"],
      [{ displayName: "Journey", role: "OWNER" }, "UNKNOWN_FIELD"],
      [{ displayName: "Journey", status: "active" }, "UNKNOWN_FIELD"],
      [{ displayName: "Journey", childId: randomUUID() }, "UNKNOWN_FIELD"],
    ] as const;

    for (const [body, code] of invalidCases) {
      const response = await createPregnancy(
        baseUrl,
        firstFamilyId,
        firstUser.cookie,
        body,
      );
      const responseBody = (await response.json()) as {
        code?: string;
      };

      assert.equal(response.status, 400);
      assert.equal(responseBody.code, code);
    }

    const maximumName = "🌿".repeat(100);
    const maximumResponse = await createPregnancy(
      baseUrl,
      firstFamilyId,
      firstUser.cookie,
      {
        displayName: maximumName,
      },
    );
    const maximumText = await maximumResponse.text();
    const maximumPregnancy = JSON.parse(maximumText) as {
      id: string;
      familyId: string;
      displayName: string;
      createdAt: string;
      updatedAt: string;
    };

    assert.equal(maximumResponse.status, 201);
    assertPregnancyShape(maximumPregnancy);
    assert.equal(maximumPregnancy.displayName, maximumName);
    assert.equal(maximumPregnancy.familyId, firstFamilyId);
    createdPregnancyIds.push(maximumPregnancy.id);
    sensitiveResponseTexts.push(maximumText);

    const duplicateResponses = await Promise.all([
      createPregnancy(baseUrl, firstFamilyId, firstUser.cookie, {
        displayName: "  Minik Yolculuk ✨  ",
      }),
      createPregnancy(baseUrl, firstFamilyId, firstUser.cookie, {
        displayName: "Minik Yolculuk ✨",
      }),
    ]);
    const duplicatePregnancies = await Promise.all(
      duplicateResponses.map(async (response) => {
        assert.equal(response.status, 201);
        const text = await response.text();
        sensitiveResponseTexts.push(text);
        return JSON.parse(text) as {
          id: string;
          familyId: string;
          displayName: string;
          createdAt: string;
          updatedAt: string;
        };
      }),
    );

    for (const pregnancy of duplicatePregnancies) {
      assertPregnancyShape(pregnancy);
      assert.equal(pregnancy.familyId, firstFamilyId);
      assert.equal(pregnancy.displayName, "Minik Yolculuk ✨");
      createdPregnancyIds.push(pregnancy.id);
    }
    assert.notEqual(duplicatePregnancies[0]?.id, duplicatePregnancies[1]?.id);

    const otherFamilyResponse = await createPregnancy(
      baseUrl,
      otherFirstUserFamilyId,
      firstUser.cookie,
      {
        displayName: "Other Family Journey",
      },
    );
    const otherFamilyPregnancy =
      (await otherFamilyResponse.json()) as typeof maximumPregnancy;
    assert.equal(otherFamilyResponse.status, 201);
    assert.equal(otherFamilyPregnancy.familyId, otherFirstUserFamilyId);
    createdPregnancyIds.push(otherFamilyPregnancy.id);

    const secondFamilyResponse = await createPregnancy(
      baseUrl,
      secondFamilyId,
      secondUser.cookie,
      {
        displayName: "Second Private Journey",
      },
    );
    const secondFamilyPregnancy =
      (await secondFamilyResponse.json()) as typeof maximumPregnancy;
    assert.equal(secondFamilyResponse.status, 201);
    assert.equal(secondFamilyPregnancy.familyId, secondFamilyId);
    createdPregnancyIds.push(secondFamilyPregnancy.id);

    const firstListResponse = await fetch(
      `${baseUrl}/families/${firstFamilyId}/pregnancies`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const firstListText = await firstListResponse.text();
    const firstList = JSON.parse(firstListText) as {
      pregnancies: (typeof maximumPregnancy)[];
    };

    assert.equal(firstListResponse.status, 200);
    assert.equal(firstList.pregnancies.length, 3);
    assert.deepEqual(
      new Set(firstList.pregnancies.map((pregnancy) => pregnancy.id)),
      new Set(createdPregnancyIds.slice(0, 3)),
    );
    firstList.pregnancies.forEach(assertPregnancyShape);
    sensitiveResponseTexts.push(firstListText);

    const otherListResponse = await fetch(
      `${baseUrl}/families/${otherFirstUserFamilyId}/pregnancies`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const otherList = (await otherListResponse.json()) as {
      pregnancies: (typeof maximumPregnancy)[];
    };
    assert.equal(otherListResponse.status, 200);
    assert.deepEqual(
      otherList.pregnancies.map((pregnancy) => pregnancy.id),
      [otherFamilyPregnancy.id],
    );

    const directResponse = await fetch(
      `${baseUrl}/families/${firstFamilyId}/pregnancies/${maximumPregnancy.id}`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const directText = await directResponse.text();
    const directPregnancy = JSON.parse(directText);

    assert.equal(directResponse.status, 200);
    assertPregnancyShape(directPregnancy);
    assert.deepEqual(directPregnancy, maximumPregnancy);
    sensitiveResponseTexts.push(directText);

    const inaccessibleCreate = await createPregnancy(
      baseUrl,
      firstFamilyId,
      secondUser.cookie,
      {
        displayName: "Forbidden",
      },
    );
    const missingCreate = await createPregnancy(
      baseUrl,
      unknownFamilyId,
      secondUser.cookie,
      {
        displayName: "Missing",
      },
    );
    assert.equal(inaccessibleCreate.status, 404);
    assert.equal(missingCreate.status, 404);
    assert.equal(await inaccessibleCreate.text(), await missingCreate.text());

    const inaccessibleList = await fetch(
      `${baseUrl}/families/${firstFamilyId}/pregnancies`,
      {
        headers: {
          Cookie: secondUser.cookie,
        },
      },
    );
    const missingList = await fetch(
      `${baseUrl}/families/${unknownFamilyId}/pregnancies`,
      {
        headers: {
          Cookie: secondUser.cookie,
        },
      },
    );
    assert.equal(inaccessibleList.status, 404);
    assert.equal(missingList.status, 404);
    assert.equal(await inaccessibleList.text(), await missingList.text());

    const inaccessiblePregnancy = await fetch(
      `${baseUrl}/families/${firstFamilyId}/pregnancies/${maximumPregnancy.id}`,
      {
        headers: {
          Cookie: secondUser.cookie,
        },
      },
    );
    const missingPregnancy = await fetch(
      `${baseUrl}/families/${firstFamilyId}/pregnancies/${randomUUID()}`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const pathMismatchedPregnancy = await fetch(
      `${baseUrl}/families/${otherFirstUserFamilyId}/pregnancies/${maximumPregnancy.id}`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const missingFamilyPregnancy = await fetch(
      `${baseUrl}/families/${unknownFamilyId}/pregnancies/${randomUUID()}`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const hiddenBodies: string[] = [];

    for (const response of [
      inaccessiblePregnancy,
      missingPregnancy,
      pathMismatchedPregnancy,
      missingFamilyPregnancy,
    ]) {
      assert.equal(response.status, 404);
      hiddenBodies.push(await response.text());
    }
    assert.equal(new Set(hiddenBodies).size, 1);

    const countBeforeRejectedRepositoryCreate = await prisma.pregnancy.count();
    assert.equal(
      await repository.createPregnancyForMember({
        familyId: firstFamilyId,
        userId: secondUser.userId,
        displayName: "Rejected Repository Write",
      }),
      null,
    );
    assert.equal(
      await prisma.pregnancy.count(),
      countBeforeRejectedRepositoryCreate,
    );

    assert.equal(
      await prisma.pregnancy.count({
        where: {
          familyId: firstFamilyId,
          displayName: "Minik Yolculuk ✨",
        },
      }),
      2,
    );
    assert.equal(
      await prisma.pregnancy.count({
        where: {
          familyId: firstFamilyId,
        },
      }),
      3,
    );

    await assert.rejects(() =>
      prisma.family.delete({
        where: {
          id: firstFamilyId,
        },
      }),
    );
    assert.equal(
      await prisma.pregnancy.count({
        where: {
          familyId: firstFamilyId,
        },
      }),
      3,
    );

    await assert.rejects(() =>
      prisma.user.delete({
        where: {
          id: firstUser.userId,
        },
      }),
    );
    assert.ok(
      await prisma.pregnancy.findUnique({
        where: {
          id: maximumPregnancy.id,
        },
      }),
    );

    for (const responseText of sensitiveResponseTexts) {
      assert.ok(!responseText.includes(firstPassword));
      assert.ok(!responseText.includes(secondPassword));
      assert.ok(!responseText.includes(firstUser.rawToken));
      assert.ok(!responseText.includes(secondUser.rawToken));
      assert.doesNotMatch(
        responseText,
        /"email"|"name"|"userId"|"role"|"token"|"session"|"account"|"password"|"status"|"childId"/,
      );
    }

    assert.ok(!childOutput.includes(firstPassword));
    assert.ok(!childOutput.includes(secondPassword));
    assert.ok(!childOutput.includes(firstUser.rawToken));
    assert.ok(!childOutput.includes(secondUser.rawToken));
  } finally {
    await stopChild(child);

    if (createdFamilyIds.length > 0) {
      await prisma.pregnancy.deleteMany({
        where: {
          familyId: {
            in: createdFamilyIds,
          },
        },
      });
      await prisma.family.deleteMany({
        where: {
          id: {
            in: createdFamilyIds,
          },
        },
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
      await prisma.pregnancy.count({
        where: {
          id: {
            in: createdPregnancyIds,
          },
        },
      }),
      0,
    );
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
