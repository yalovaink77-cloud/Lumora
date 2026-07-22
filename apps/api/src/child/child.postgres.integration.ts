import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { test } from "node:test";

import {
  disconnectPrismaClient,
  getPrismaClient,
  PrismaChildRepository,
} from "@lumora/database";

const testDatabaseUrl = process.env.AUTH_TEST_DATABASE_URL;

function assertDisposableDatabaseUrl(
  databaseUrl: string | undefined,
): asserts databaseUrl is string {
  assert.ok(
    databaseUrl,
    "AUTH_TEST_DATABASE_URL is required. Run through pnpm test:child:postgres.",
  );
  const parsed = new URL(databaseUrl);

  assert.ok(
    ["127.0.0.1", "localhost"].includes(parsed.hostname),
    "The Child runtime test only accepts local disposable PostgreSQL.",
  );
  assert.match(
    parsed.pathname,
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

async function stopProcess(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null || process.signalCode !== null) {
    return;
  }

  process.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => process.once("exit", () => resolve())),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        process.kill("SIGKILL");
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

async function createChild(
  baseUrl: string,
  familyId: string,
  cookie: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${baseUrl}/families/${familyId}/children`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

async function updateChildDisplayName(
  baseUrl: string,
  familyId: string,
  childId: string,
  cookie: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${baseUrl}/families/${familyId}/children/${childId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

type ChildResponse = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

function assertChildShape(value: unknown): asserts value is ChildResponse {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value), [
    "id",
    "familyId",
    "displayName",
    "createdAt",
    "updatedAt",
  ]);
}

test("Child runtime enforces validation, scoped authorization, and privacy", async () => {
  assertDisposableDatabaseUrl(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;

  const prisma = getPrismaClient();
  const repository = new PrismaChildRepository();
  const apiPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${apiPort}`;
  const suffix = randomUUID();
  const firstPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const secondPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const createdFamilyIds: string[] = [];
  const createdChildIds: string[] = [];
  const createdUserIds: string[] = [];
  const sensitiveResponseTexts: string[] = [];
  let processOutput = "";

  const apiProcess = spawn("node", ["dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_TRUSTED_ORIGINS: baseUrl,
      AUTH_EMAIL_VERIFICATION_DELIVERY_MODE: "capture",
      AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL: `${baseUrl}/verify-email`,
      BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
      BETTER_AUTH_URL: baseUrl,
      DATABASE_URL: testDatabaseUrl,
      LUMORA_ENABLE_TEST_HTTP_ROUTES: "false",
      NODE_ENV: "test",
      PORT: String(apiPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  apiProcess.stdout?.on("data", (chunk: Buffer) => {
    processOutput += chunk.toString();
  });
  apiProcess.stderr?.on("data", (chunk: Buffer) => {
    processOutput += chunk.toString();
  });

  try {
    await waitForServerReady(baseUrl, () => processOutput);

    const unknownFamilyId = randomUUID();
    const unauthenticatedResponses = await Promise.all([
      createChild(baseUrl, unknownFamilyId, "", {
        displayName: "Private Child",
      }),
      fetch(`${baseUrl}/families/${unknownFamilyId}/children`),
      fetch(`${baseUrl}/families/${unknownFamilyId}/children/${randomUUID()}`),
      updateChildDisplayName(baseUrl, unknownFamilyId, randomUUID(), "", {
        displayName: "Private Mutation",
      }),
    ]);

    for (const response of unauthenticatedResponses) {
      assert.equal(response.status, 401);
    }

    const firstUser = await registerUser(
      baseUrl,
      `child-a-${suffix}@example.test`,
      "First Child User",
      firstPassword,
    );
    const secondUser = await registerUser(
      baseUrl,
      `child-b-${suffix}@example.test`,
      "Second Child User",
      secondPassword,
    );
    createdUserIds.push(firstUser.userId, secondUser.userId);

    const firstFamilyId = await createFamily(
      baseUrl,
      firstUser.cookie,
      "First Child Family",
    );
    const otherFirstUserFamilyId = await createFamily(
      baseUrl,
      firstUser.cookie,
      "Other Child Family",
    );
    const secondFamilyId = await createFamily(
      baseUrl,
      secondUser.cookie,
      "Second Child Family",
    );
    createdFamilyIds.push(
      firstFamilyId,
      otherFirstUserFamilyId,
      secondFamilyId,
    );

    const invalidCases = [
      [{}, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: 42 }, "DISPLAY_NAME_INVALID"],
      [{ displayName: "" }, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: " \t " }, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: "🌿".repeat(81) }, "DISPLAY_NAME_TOO_LONG"],
      [{ displayName: "Deniz", familyId: secondFamilyId }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", userId: secondUser.userId }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", role: "OWNER" }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", legalName: "Hidden" }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", birthDate: "2026-01-01" }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", gender: "unspecified" }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", guardianId: randomUUID() }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", pregnancyId: randomUUID() }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", medicalId: "private" }, "UNKNOWN_FIELD"],
      [{ displayName: "Deniz", ownerId: firstUser.userId }, "UNKNOWN_FIELD"],
    ] as const;

    for (const [body, code] of invalidCases) {
      const response = await createChild(
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

    const maximumName = "🌿".repeat(80);
    const maximumResponse = await createChild(
      baseUrl,
      firstFamilyId,
      firstUser.cookie,
      {
        displayName: maximumName,
      },
    );
    const maximumText = await maximumResponse.text();
    const maximumChild = JSON.parse(maximumText) as ChildResponse;

    assert.equal(maximumResponse.status, 201);
    assertChildShape(maximumChild);
    assert.equal(maximumChild.displayName, maximumName);
    assert.equal(maximumChild.familyId, firstFamilyId);
    createdChildIds.push(maximumChild.id);
    sensitiveResponseTexts.push(maximumText);

    const duplicateResponses = await Promise.all([
      createChild(baseUrl, firstFamilyId, firstUser.cookie, {
        displayName: "  Deniz 🌿  ",
      }),
      createChild(baseUrl, firstFamilyId, firstUser.cookie, {
        displayName: "Deniz 🌿",
      }),
    ]);
    const duplicates: ChildResponse[] = [];

    for (const response of duplicateResponses) {
      assert.equal(response.status, 201);
      const text = await response.text();
      const child = JSON.parse(text) as ChildResponse;
      assertChildShape(child);
      assert.equal(child.familyId, firstFamilyId);
      assert.equal(child.displayName, "Deniz 🌿");
      duplicates.push(child);
      createdChildIds.push(child.id);
      sensitiveResponseTexts.push(text);
    }
    assert.notEqual(duplicates[0]?.id, duplicates[1]?.id);

    const otherFamilyResponse = await createChild(
      baseUrl,
      otherFirstUserFamilyId,
      firstUser.cookie,
      {
        displayName: "Other Family Child",
      },
    );
    const otherFamilyChild =
      (await otherFamilyResponse.json()) as ChildResponse;
    assert.equal(otherFamilyResponse.status, 201);
    assert.equal(otherFamilyChild.familyId, otherFirstUserFamilyId);
    createdChildIds.push(otherFamilyChild.id);

    const secondFamilyResponse = await createChild(
      baseUrl,
      secondFamilyId,
      secondUser.cookie,
      {
        displayName: "Second Private Child",
      },
    );
    const secondFamilyChild =
      (await secondFamilyResponse.json()) as ChildResponse;
    assert.equal(secondFamilyResponse.status, 201);
    createdChildIds.push(secondFamilyChild.id);

    const listResponse = await fetch(
      `${baseUrl}/families/${firstFamilyId}/children`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const listText = await listResponse.text();
    const list = JSON.parse(listText) as {
      children: ChildResponse[];
    };

    assert.equal(listResponse.status, 200);
    assert.equal(list.children.length, 3);
    assert.deepEqual(
      new Set(list.children.map((child) => child.id)),
      new Set(createdChildIds.slice(0, 3)),
    );
    list.children.forEach(assertChildShape);
    sensitiveResponseTexts.push(listText);

    const otherListResponse = await fetch(
      `${baseUrl}/families/${otherFirstUserFamilyId}/children`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const otherList = (await otherListResponse.json()) as {
      children: ChildResponse[];
    };
    assert.equal(otherListResponse.status, 200);
    assert.deepEqual(
      otherList.children.map((child) => child.id),
      [otherFamilyChild.id],
    );

    const directResponse = await fetch(
      `${baseUrl}/families/${firstFamilyId}/children/${maximumChild.id}`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const directText = await directResponse.text();
    const directChild = JSON.parse(directText);

    assert.equal(directResponse.status, 200);
    assertChildShape(directChild);
    assert.deepEqual(directChild, maximumChild);
    sensitiveResponseTexts.push(directText);

    const mutationInvalidCases = [
      [{}, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: 42 }, "DISPLAY_NAME_INVALID"],
      [{ displayName: "" }, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: " \t " }, "DISPLAY_NAME_REQUIRED"],
      [{ displayName: "🌿".repeat(81) }, "DISPLAY_NAME_TOO_LONG"],
      [{ displayName: "Mutation", id: maximumChild.id }, "UNKNOWN_FIELD"],
      [{ displayName: "Mutation", familyId: secondFamilyId }, "UNKNOWN_FIELD"],
      [{ displayName: "Mutation", childId: randomUUID() }, "UNKNOWN_FIELD"],
      [{ displayName: "Mutation", updatedAt: new Date() }, "UNKNOWN_FIELD"],
      [{ displayName: "Mutation", userId: secondUser.userId }, "UNKNOWN_FIELD"],
      [{ displayName: "Mutation", guardianId: randomUUID() }, "UNKNOWN_FIELD"],
      [{ displayName: "Mutation", pregnancyId: randomUUID() }, "UNKNOWN_FIELD"],
    ] as const;

    for (const [body, code] of mutationInvalidCases) {
      const response = await updateChildDisplayName(
        baseUrl,
        firstFamilyId,
        maximumChild.id,
        firstUser.cookie,
        body,
      );
      const responseBody = (await response.json()) as {
        code?: string;
        message?: string;
      };

      assert.equal(response.status, 400);
      assert.equal(responseBody.code, code);
      assert.equal(
        responseBody.message,
        "Invalid child display name update request.",
      );
    }

    const persistedBeforeMutation = await prisma.child.findUniqueOrThrow({
      where: {
        id: maximumChild.id,
      },
    });
    const trimmedUpdateResponse = await updateChildDisplayName(
      baseUrl,
      firstFamilyId,
      maximumChild.id,
      firstUser.cookie,
      {
        displayName: "  Güncel Etiket 🌿  ",
      },
    );
    const trimmedUpdateText = await trimmedUpdateResponse.text();
    const trimmedUpdate = JSON.parse(trimmedUpdateText) as ChildResponse;

    assert.equal(trimmedUpdateResponse.status, 200);
    assertChildShape(trimmedUpdate);
    assert.equal(trimmedUpdate.id, maximumChild.id);
    assert.equal(trimmedUpdate.familyId, firstFamilyId);
    assert.equal(trimmedUpdate.displayName, "Güncel Etiket 🌿");
    assert.equal(trimmedUpdate.createdAt, maximumChild.createdAt);
    assert.notEqual(trimmedUpdate.updatedAt, maximumChild.updatedAt);
    sensitiveResponseTexts.push(trimmedUpdateText);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const sameValueResponse = await updateChildDisplayName(
      baseUrl,
      firstFamilyId,
      maximumChild.id,
      firstUser.cookie,
      {
        displayName: "Güncel Etiket 🌿",
      },
    );
    const sameValueText = await sameValueResponse.text();
    const sameValueUpdate = JSON.parse(sameValueText) as ChildResponse;

    assert.equal(sameValueResponse.status, 200);
    assertChildShape(sameValueUpdate);
    assert.equal(sameValueUpdate.displayName, "Güncel Etiket 🌿");
    assert.notEqual(sameValueUpdate.updatedAt, trimmedUpdate.updatedAt);
    sensitiveResponseTexts.push(sameValueText);

    const duplicateUpdateResponse = await updateChildDisplayName(
      baseUrl,
      firstFamilyId,
      maximumChild.id,
      firstUser.cookie,
      {
        displayName: "Deniz 🌿",
      },
    );
    const duplicateUpdate =
      (await duplicateUpdateResponse.json()) as ChildResponse;

    assert.equal(duplicateUpdateResponse.status, 200);
    assert.equal(duplicateUpdate.displayName, "Deniz 🌿");
    assert.equal(
      await prisma.child.count({
        where: {
          familyId: firstFamilyId,
          displayName: "Deniz 🌿",
        },
      }),
      3,
    );

    const persistedAfterMutation = await prisma.child.findUniqueOrThrow({
      where: {
        id: maximumChild.id,
      },
    });
    assert.equal(persistedAfterMutation.id, persistedBeforeMutation.id);
    assert.equal(
      persistedAfterMutation.familyId,
      persistedBeforeMutation.familyId,
    );
    assert.equal(
      persistedAfterMutation.createdAt.toISOString(),
      persistedBeforeMutation.createdAt.toISOString(),
    );

    const inaccessibleCreate = await createChild(
      baseUrl,
      firstFamilyId,
      secondUser.cookie,
      {
        displayName: "Forbidden",
      },
    );
    const missingCreate = await createChild(
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
      `${baseUrl}/families/${firstFamilyId}/children`,
      {
        headers: {
          Cookie: secondUser.cookie,
        },
      },
    );
    const missingList = await fetch(
      `${baseUrl}/families/${unknownFamilyId}/children`,
      {
        headers: {
          Cookie: secondUser.cookie,
        },
      },
    );
    assert.equal(inaccessibleList.status, 404);
    assert.equal(missingList.status, 404);
    assert.equal(await inaccessibleList.text(), await missingList.text());

    const hiddenResponses = await Promise.all([
      fetch(
        `${baseUrl}/families/${firstFamilyId}/children/${maximumChild.id}`,
        {
          headers: {
            Cookie: secondUser.cookie,
          },
        },
      ),
      fetch(`${baseUrl}/families/${firstFamilyId}/children/${randomUUID()}`, {
        headers: {
          Cookie: firstUser.cookie,
        },
      }),
      fetch(
        `${baseUrl}/families/${otherFirstUserFamilyId}/children/${maximumChild.id}`,
        {
          headers: {
            Cookie: firstUser.cookie,
          },
        },
      ),
      fetch(`${baseUrl}/families/${unknownFamilyId}/children/${randomUUID()}`, {
        headers: {
          Cookie: firstUser.cookie,
        },
      }),
    ]);
    const hiddenBodies: string[] = [];

    for (const response of hiddenResponses) {
      assert.equal(response.status, 404);
      hiddenBodies.push(await response.text());
    }
    assert.equal(new Set(hiddenBodies).size, 1);

    const hiddenMutationResponses = await Promise.all([
      updateChildDisplayName(
        baseUrl,
        firstFamilyId,
        maximumChild.id,
        secondUser.cookie,
        {
          displayName: "Inaccessible Mutation",
        },
      ),
      updateChildDisplayName(
        baseUrl,
        firstFamilyId,
        randomUUID(),
        firstUser.cookie,
        {
          displayName: "Missing Mutation",
        },
      ),
      updateChildDisplayName(
        baseUrl,
        otherFirstUserFamilyId,
        maximumChild.id,
        firstUser.cookie,
        {
          displayName: "Mismatched Mutation",
        },
      ),
      updateChildDisplayName(
        baseUrl,
        unknownFamilyId,
        randomUUID(),
        firstUser.cookie,
        {
          displayName: "Missing Family Mutation",
        },
      ),
    ]);
    const hiddenMutationBodies: string[] = [];

    for (const response of hiddenMutationResponses) {
      assert.equal(response.status, 404);
      hiddenMutationBodies.push(await response.text());
    }
    assert.equal(new Set(hiddenMutationBodies).size, 1);
    assert.deepEqual(JSON.parse(hiddenMutationBodies[0] ?? "{}"), {
      statusCode: 404,
      code: "CHILD_NOT_FOUND",
      message: "Child not found.",
    });
    assert.equal(
      (
        await prisma.child.findUniqueOrThrow({
          where: {
            id: maximumChild.id,
          },
        })
      ).displayName,
      "Deniz 🌿",
    );

    const countBeforeRejectedCreate = await prisma.child.count();
    assert.equal(
      await repository.createChildForMember({
        familyId: firstFamilyId,
        userId: secondUser.userId,
        displayName: "Rejected Repository Write",
      }),
      null,
    );
    assert.equal(await prisma.child.count(), countBeforeRejectedCreate);
    assert.equal(
      await repository.updateChildDisplayNameForMember({
        familyId: firstFamilyId,
        childId: maximumChild.id,
        userId: secondUser.userId,
        displayName: "Rejected Repository Mutation",
      }),
      null,
    );
    assert.equal(
      (
        await prisma.child.findUniqueOrThrow({
          where: {
            id: maximumChild.id,
          },
        })
      ).displayName,
      "Deniz 🌿",
    );
    assert.equal(
      await prisma.child.count({
        where: {
          familyId: firstFamilyId,
          displayName: "Deniz 🌿",
        },
      }),
      3,
    );

    const concurrentLabels = ["Concurrent Alpha", "Concurrent Beta"] as const;
    const concurrentResponses = await Promise.all(
      concurrentLabels.map((displayName) =>
        updateChildDisplayName(
          baseUrl,
          otherFirstUserFamilyId,
          otherFamilyChild.id,
          firstUser.cookie,
          {
            displayName,
          },
        ),
      ),
    );
    const concurrentUpdates = await Promise.all(
      concurrentResponses.map(async (response) => {
        assert.equal(response.status, 200);
        const updated = (await response.json()) as ChildResponse;
        assertChildShape(updated);
        return updated;
      }),
    );

    assert.deepEqual(
      new Set(concurrentUpdates.map((child) => child.displayName)),
      new Set(concurrentLabels),
    );
    const concurrentPersisted = await prisma.child.findUniqueOrThrow({
      where: {
        id: otherFamilyChild.id,
      },
    });
    assert.ok(
      concurrentLabels.includes(
        concurrentPersisted.displayName as (typeof concurrentLabels)[number],
      ),
    );

    await assert.rejects(() =>
      prisma.family.delete({
        where: {
          id: firstFamilyId,
        },
      }),
    );
    assert.ok(
      await prisma.child.findUnique({
        where: {
          id: maximumChild.id,
        },
      }),
    );

    await assert.rejects(() =>
      prisma.user.delete({
        where: {
          id: firstUser.userId,
        },
      }),
    );
    assert.ok(
      await prisma.child.findUnique({
        where: {
          id: maximumChild.id,
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
        /"email"|"name"|"userId"|"role"|"token"|"session"|"account"|"password"|"legalName"|"birthDate"|"gender"|"guardianId"|"pregnancyId"|"medicalId"|"ownerId"/,
      );
    }

    assert.ok(!processOutput.includes(firstPassword));
    assert.ok(!processOutput.includes(secondPassword));
    assert.ok(!processOutput.includes(firstUser.rawToken));
    assert.ok(!processOutput.includes(secondUser.rawToken));
    for (const childLabel of [
      "Güncel Etiket 🌿",
      "Concurrent Alpha",
      "Concurrent Beta",
      "Inaccessible Mutation",
      "Mismatched Mutation",
    ]) {
      assert.ok(!processOutput.includes(childLabel));
    }
  } finally {
    await stopProcess(apiProcess);

    if (createdFamilyIds.length > 0) {
      await prisma.child.deleteMany({
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
      await prisma.child.count({
        where: {
          id: {
            in: createdChildIds,
          },
        },
      }),
      0,
    );
    await disconnectPrismaClient();
  }
});
