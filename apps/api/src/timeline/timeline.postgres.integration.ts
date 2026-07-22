import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { test } from "node:test";

import {
  disconnectPrismaClient,
  getPrismaClient,
  PrismaTimelineRepository,
} from "@lumora/database";

const testDatabaseUrl = process.env.AUTH_TEST_DATABASE_URL;

type RegisteredUser = {
  cookie: string;
  rawToken: string;
  userId: string;
};

type SubjectKind = "pregnancies" | "children";

type TimelineEventResponse = {
  id: string;
  familyId: string;
  pregnancyId?: string;
  childId?: string;
  title: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

function assertDisposableDatabaseUrl(
  databaseUrl: string | undefined,
): asserts databaseUrl is string {
  assert.ok(
    databaseUrl,
    "AUTH_TEST_DATABASE_URL is required. Run through pnpm test:timeline:postgres.",
  );
  const parsed = new URL(databaseUrl);

  assert.ok(
    ["127.0.0.1", "localhost"].includes(parsed.hostname),
    "The Timeline runtime test only accepts local disposable PostgreSQL.",
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
): Promise<RegisteredUser> {
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

async function createSubject(
  baseUrl: string,
  familyId: string,
  cookie: string,
  kind: SubjectKind,
  displayName: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/families/${familyId}/${kind}`, {
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
    id?: string;
  };

  assert.equal(response.status, 201);
  assert.ok(body.id);
  return body.id;
}

function timelineUrl(
  baseUrl: string,
  familyId: string,
  kind: SubjectKind,
  subjectId: string,
  timelineEventId?: string,
): string {
  const collection = `${baseUrl}/families/${familyId}/${kind}/${subjectId}/timeline-events`;

  return timelineEventId ? `${collection}/${timelineEventId}` : collection;
}

async function createTimelineEvent(
  baseUrl: string,
  familyId: string,
  kind: SubjectKind,
  subjectId: string,
  cookie: string,
  body: unknown,
): Promise<Response> {
  return fetch(timelineUrl(baseUrl, familyId, kind, subjectId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

function assertTimelineEventShape(
  value: unknown,
  subject: {
    kind: SubjectKind;
    id: string;
  },
): asserts value is TimelineEventResponse {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const expectedSubjectKey =
    subject.kind === "pregnancies" ? "pregnancyId" : "childId";

  assert.deepEqual(Object.keys(value), [
    "id",
    "familyId",
    expectedSubjectKey,
    "title",
    "occurredAt",
    "createdAt",
    "updatedAt",
  ]);
  const event = value as TimelineEventResponse;

  assert.equal(event[expectedSubjectKey], subject.id);
  assert.equal(
    subject.kind === "pregnancies" ? event.childId : event.pregnancyId,
    undefined,
  );
  assert.match(event.occurredAt, /^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/);
}

test("Timeline runtime enforces contracts, chronology, and isolation", async () => {
  assertDisposableDatabaseUrl(testDatabaseUrl);
  process.env.DATABASE_URL = testDatabaseUrl;

  const prisma = getPrismaClient();
  const repository = new PrismaTimelineRepository();
  const apiPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${apiPort}`;
  const suffix = randomUUID();
  const firstPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const secondPassword = `Runtime-${randomBytes(18).toString("base64url")}!`;
  const createdFamilyIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdTimelineEventIds: string[] = [];
  const sensitiveResponseTexts: string[] = [];
  let processOutput = "";

  const apiProcess = spawn("node", ["dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_TRUSTED_ORIGINS: baseUrl,
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
    const unknownPregnancyId = randomUUID();
    const unknownChildId = randomUUID();
    const unauthenticatedResponses = await Promise.all([
      createTimelineEvent(
        baseUrl,
        unknownFamilyId,
        "pregnancies",
        unknownPregnancyId,
        "",
        {
          title: "Private event",
          occurredAt: "2026-07-22T11:10:00.000Z",
        },
      ),
      fetch(
        timelineUrl(
          baseUrl,
          unknownFamilyId,
          "pregnancies",
          unknownPregnancyId,
        ),
      ),
      fetch(
        timelineUrl(
          baseUrl,
          unknownFamilyId,
          "pregnancies",
          unknownPregnancyId,
          randomUUID(),
        ),
      ),
      createTimelineEvent(
        baseUrl,
        unknownFamilyId,
        "children",
        unknownChildId,
        "",
        {
          title: "Private event",
          occurredAt: "2026-07-22T11:10:00.000Z",
        },
      ),
      fetch(timelineUrl(baseUrl, unknownFamilyId, "children", unknownChildId)),
      fetch(
        timelineUrl(
          baseUrl,
          unknownFamilyId,
          "children",
          unknownChildId,
          randomUUID(),
        ),
      ),
    ]);

    for (const response of unauthenticatedResponses) {
      assert.equal(response.status, 401);
    }

    const firstUser = await registerUser(
      baseUrl,
      `timeline-a-${suffix}@example.test`,
      "First Timeline User",
      firstPassword,
    );
    const secondUser = await registerUser(
      baseUrl,
      `timeline-b-${suffix}@example.test`,
      "Second Timeline User",
      secondPassword,
    );
    createdUserIds.push(firstUser.userId, secondUser.userId);

    const firstFamilyId = await createFamily(
      baseUrl,
      firstUser.cookie,
      "First Timeline Family",
    );
    const otherFirstUserFamilyId = await createFamily(
      baseUrl,
      firstUser.cookie,
      "Other Timeline Family",
    );
    const secondFamilyId = await createFamily(
      baseUrl,
      secondUser.cookie,
      "Second Timeline Family",
    );
    createdFamilyIds.push(
      firstFamilyId,
      otherFirstUserFamilyId,
      secondFamilyId,
    );

    const firstPregnancyId = await createSubject(
      baseUrl,
      firstFamilyId,
      firstUser.cookie,
      "pregnancies",
      "First Pregnancy",
    );
    const orderingPregnancyId = await createSubject(
      baseUrl,
      firstFamilyId,
      firstUser.cookie,
      "pregnancies",
      "Ordering Pregnancy",
    );
    const otherPregnancyId = await createSubject(
      baseUrl,
      otherFirstUserFamilyId,
      firstUser.cookie,
      "pregnancies",
      "Other Pregnancy",
    );
    const secondPregnancyId = await createSubject(
      baseUrl,
      secondFamilyId,
      secondUser.cookie,
      "pregnancies",
      "Second Pregnancy",
    );
    const firstChildId = await createSubject(
      baseUrl,
      firstFamilyId,
      firstUser.cookie,
      "children",
      "First Child",
    );
    const otherChildId = await createSubject(
      baseUrl,
      otherFirstUserFamilyId,
      firstUser.cookie,
      "children",
      "Other Child",
    );
    const secondChildId = await createSubject(
      baseUrl,
      secondFamilyId,
      secondUser.cookie,
      "children",
      "Second Child",
    );
    createdSubjectIds.push(
      firstPregnancyId,
      orderingPregnancyId,
      otherPregnancyId,
      secondPregnancyId,
      firstChildId,
      otherChildId,
      secondChildId,
    );

    const invalidCases = [
      [{ occurredAt: "2026-07-22T11:10:00.000Z" }, "TITLE_REQUIRED"],
      [{ title: 42, occurredAt: "2026-07-22T11:10:00.000Z" }, "TITLE_INVALID"],
      [
        { title: " \t ", occurredAt: "2026-07-22T11:10:00.000Z" },
        "TITLE_REQUIRED",
      ],
      [
        {
          title: "🌿".repeat(81),
          occurredAt: "2026-07-22T11:10:00.000Z",
        },
        "TITLE_TOO_LONG",
      ],
      [{ title: "Event" }, "OCCURRED_AT_REQUIRED"],
      [{ title: "Event", occurredAt: 42 }, "OCCURRED_AT_INVALID"],
      [
        { title: "Event", occurredAt: "2026-07-22T11:10:00Z" },
        "OCCURRED_AT_INVALID",
      ],
      [
        { title: "Event", occurredAt: "2026-07-22T11:10:00.000" },
        "OCCURRED_AT_INVALID",
      ],
      [
        { title: "Event", occurredAt: "2026-02-29T11:10:00.000Z" },
        "OCCURRED_AT_INVALID",
      ],
      [
        {
          title: "Private title that must not echo",
          occurredAt: "2026-07-22T11:10:00.000Z",
          medicalClassification: "private",
        },
        "UNKNOWN_FIELD",
      ],
    ] as const;

    for (const [body, code] of invalidCases) {
      const response = await createTimelineEvent(
        baseUrl,
        firstFamilyId,
        "pregnancies",
        firstPregnancyId,
        firstUser.cookie,
        body,
      );
      const responseText = await response.text();
      const responseBody = JSON.parse(responseText) as {
        code?: string;
      };

      assert.equal(response.status, 400);
      assert.equal(responseBody.code, code);
      assert.ok(!responseText.includes("Private title that must not echo"));
      assert.ok(!responseText.includes("medicalClassification"));
    }

    const invalidMissingTarget = await createTimelineEvent(
      baseUrl,
      unknownFamilyId,
      "pregnancies",
      unknownPregnancyId,
      firstUser.cookie,
      {
        title: "Event",
      },
    );
    assert.equal(invalidMissingTarget.status, 400);
    assert.equal(
      ((await invalidMissingTarget.json()) as { code?: string }).code,
      "OCCURRED_AT_REQUIRED",
    );

    const unknownQueryResponse = await fetch(
      `${timelineUrl(
        baseUrl,
        firstFamilyId,
        "pregnancies",
        firstPregnancyId,
      )}?page=1`,
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    assert.equal(unknownQueryResponse.status, 400);
    assert.equal(
      ((await unknownQueryResponse.json()) as { code?: string }).code,
      "UNKNOWN_QUERY_PARAMETER",
    );

    const pregnancyCreateResponse = await createTimelineEvent(
      baseUrl,
      firstFamilyId,
      "pregnancies",
      firstPregnancyId,
      firstUser.cookie,
      {
        title: `  ${"🌿".repeat(80)}  `,
        occurredAt: "2026-07-22T14:10:00.123+03:00",
      },
    );
    const pregnancyCreateText = await pregnancyCreateResponse.text();
    const pregnancyEvent = JSON.parse(
      pregnancyCreateText,
    ) as TimelineEventResponse;

    assert.equal(pregnancyCreateResponse.status, 201);
    assertTimelineEventShape(pregnancyEvent, {
      kind: "pregnancies",
      id: firstPregnancyId,
    });
    assert.equal(pregnancyEvent.familyId, firstFamilyId);
    assert.equal(pregnancyEvent.title, "🌿".repeat(80));
    assert.equal(pregnancyEvent.occurredAt, "2026-07-22T11:10:00.123Z");
    createdTimelineEventIds.push(pregnancyEvent.id);
    sensitiveResponseTexts.push(pregnancyCreateText);

    const duplicateChildEvents: TimelineEventResponse[] = [];

    for (const title of ["  First step ✨  ", "First step ✨"]) {
      const response = await createTimelineEvent(
        baseUrl,
        firstFamilyId,
        "children",
        firstChildId,
        firstUser.cookie,
        {
          title,
          occurredAt: "2026-07-20T09:30:00.000Z",
        },
      );
      const text = await response.text();
      const event = JSON.parse(text) as TimelineEventResponse;

      assert.equal(response.status, 201);
      assertTimelineEventShape(event, {
        kind: "children",
        id: firstChildId,
      });
      assert.equal(event.title, "First step ✨");
      duplicateChildEvents.push(event);
      createdTimelineEventIds.push(event.id);
      sensitiveResponseTexts.push(text);
    }
    assert.notEqual(duplicateChildEvents[0]?.id, duplicateChildEvents[1]?.id);

    const otherFamilyEventResponse = await createTimelineEvent(
      baseUrl,
      otherFirstUserFamilyId,
      "children",
      otherChildId,
      firstUser.cookie,
      {
        title: "Other Family Event",
        occurredAt: "2026-07-21T10:00:00.000Z",
      },
    );
    const otherFamilyEvent =
      (await otherFamilyEventResponse.json()) as TimelineEventResponse;
    assert.equal(otherFamilyEventResponse.status, 201);
    createdTimelineEventIds.push(otherFamilyEvent.id);

    const secondFamilyEventResponse = await createTimelineEvent(
      baseUrl,
      secondFamilyId,
      "pregnancies",
      secondPregnancyId,
      secondUser.cookie,
      {
        title: "Second Family Event",
        occurredAt: "2026-07-21T10:00:00.000Z",
      },
    );
    const secondFamilyEvent =
      (await secondFamilyEventResponse.json()) as TimelineEventResponse;
    assert.equal(secondFamilyEventResponse.status, 201);
    createdTimelineEventIds.push(secondFamilyEvent.id);

    const pregnancyListResponse = await fetch(
      timelineUrl(baseUrl, firstFamilyId, "pregnancies", firstPregnancyId),
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const pregnancyListText = await pregnancyListResponse.text();
    const pregnancyList = JSON.parse(pregnancyListText) as {
      timelineEvents: TimelineEventResponse[];
    };

    assert.equal(pregnancyListResponse.status, 200);
    assert.deepEqual(
      pregnancyList.timelineEvents.map((event) => event.id),
      [pregnancyEvent.id],
    );
    pregnancyList.timelineEvents.forEach((event) =>
      assertTimelineEventShape(event, {
        kind: "pregnancies",
        id: firstPregnancyId,
      }),
    );
    sensitiveResponseTexts.push(pregnancyListText);

    const childListResponse = await fetch(
      timelineUrl(baseUrl, firstFamilyId, "children", firstChildId),
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const childList = (await childListResponse.json()) as {
      timelineEvents: TimelineEventResponse[];
    };
    assert.equal(childListResponse.status, 200);
    assert.deepEqual(
      new Set(childList.timelineEvents.map((event) => event.id)),
      new Set(duplicateChildEvents.map((event) => event.id)),
    );
    childList.timelineEvents.forEach((event) =>
      assertTimelineEventShape(event, {
        kind: "children",
        id: firstChildId,
      }),
    );

    const emptyListResponse = await fetch(
      timelineUrl(baseUrl, firstFamilyId, "pregnancies", orderingPregnancyId),
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    assert.deepEqual(await emptyListResponse.json(), {
      timelineEvents: [],
    });

    const directResponse = await fetch(
      timelineUrl(
        baseUrl,
        firstFamilyId,
        "pregnancies",
        firstPregnancyId,
        pregnancyEvent.id,
      ),
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const directText = await directResponse.text();
    assert.equal(directResponse.status, 200);
    assert.deepEqual(JSON.parse(directText), pregnancyEvent);
    sensitiveResponseTexts.push(directText);

    const notFoundRequests = [
      createTimelineEvent(
        baseUrl,
        firstFamilyId,
        "pregnancies",
        firstPregnancyId,
        secondUser.cookie,
        {
          title: "Hidden",
          occurredAt: "2026-07-22T11:10:00.000Z",
        },
      ),
      createTimelineEvent(
        baseUrl,
        unknownFamilyId,
        "pregnancies",
        unknownPregnancyId,
        firstUser.cookie,
        {
          title: "Missing",
          occurredAt: "2026-07-22T11:10:00.000Z",
        },
      ),
      createTimelineEvent(
        baseUrl,
        firstFamilyId,
        "pregnancies",
        secondPregnancyId,
        firstUser.cookie,
        {
          title: "Cross Family",
          occurredAt: "2026-07-22T11:10:00.000Z",
        },
      ),
      fetch(
        timelineUrl(
          baseUrl,
          firstFamilyId,
          "children",
          firstChildId,
          pregnancyEvent.id,
        ),
        {
          headers: {
            Cookie: firstUser.cookie,
          },
        },
      ),
      fetch(
        timelineUrl(
          baseUrl,
          firstFamilyId,
          "pregnancies",
          "%20",
          pregnancyEvent.id,
        ),
        {
          headers: {
            Cookie: firstUser.cookie,
          },
        },
      ),
      fetch(
        timelineUrl(
          baseUrl,
          otherFirstUserFamilyId,
          "pregnancies",
          otherPregnancyId,
          pregnancyEvent.id,
        ),
        {
          headers: {
            Cookie: firstUser.cookie,
          },
        },
      ),
      fetch(
        timelineUrl(
          baseUrl,
          firstFamilyId,
          "pregnancies",
          orderingPregnancyId,
          pregnancyEvent.id,
        ),
        {
          headers: {
            Cookie: firstUser.cookie,
          },
        },
      ),
      fetch(
        timelineUrl(
          baseUrl,
          firstFamilyId,
          "pregnancies",
          firstPregnancyId,
          randomUUID(),
        ),
        {
          headers: {
            Cookie: firstUser.cookie,
          },
        },
      ),
      fetch(
        timelineUrl(
          baseUrl,
          secondFamilyId,
          "pregnancies",
          secondPregnancyId,
          secondFamilyEvent.id,
        ),
        {
          headers: {
            Cookie: firstUser.cookie,
          },
        },
      ),
    ];
    const notFoundBodies: string[] = [];

    for (const response of await Promise.all(notFoundRequests)) {
      assert.equal(response.status, 404);
      notFoundBodies.push(await response.text());
    }
    assert.equal(new Set(notFoundBodies).size, 1);
    assert.deepEqual(JSON.parse(notFoundBodies[0] ?? ""), {
      statusCode: 404,
      code: "TIMELINE_NOT_FOUND",
      message: "Timeline resource not found.",
    });

    const excludedRouteResponses = await Promise.all([
      fetch(
        timelineUrl(
          baseUrl,
          firstFamilyId,
          "pregnancies",
          firstPregnancyId,
          pregnancyEvent.id,
        ),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: firstUser.cookie,
          },
          body: JSON.stringify({
            title: "Forbidden update",
          }),
        },
      ),
      fetch(
        timelineUrl(
          baseUrl,
          firstFamilyId,
          "children",
          firstChildId,
          duplicateChildEvents[0]?.id,
        ),
        {
          method: "DELETE",
          headers: {
            Cookie: firstUser.cookie,
          },
        },
      ),
      fetch(`${baseUrl}/families/${firstFamilyId}/timeline-events`, {
        headers: {
          Cookie: firstUser.cookie,
        },
      }),
      fetch(
        timelineUrl(baseUrl, firstFamilyId, "pregnancies", firstPregnancyId),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: firstUser.cookie,
          },
          body: JSON.stringify({
            title: "Forbidden upsert",
            occurredAt: "2026-07-22T11:10:00.000Z",
          }),
        },
      ),
    ]);

    for (const response of excludedRouteResponses) {
      assert.equal(response.status, 404);
    }

    const countBeforeRejectedRepositoryCreate =
      await prisma.timelineEvent.count();
    assert.equal(
      await repository.createTimelineEventForMember({
        familyId: firstFamilyId,
        userId: secondUser.userId,
        subject: {
          type: "CHILD",
          childId: firstChildId,
        },
        title: "Rejected Repository Event",
        occurredAt: new Date("2026-07-22T11:10:00.000Z"),
      }),
      null,
    );
    assert.equal(
      await prisma.timelineEvent.count(),
      countBeforeRejectedRepositoryCreate,
    );

    const constraintInput = {
      familyId: firstFamilyId,
      title: "Constraint Test",
      occurredAt: new Date("2026-07-22T11:10:00.000Z"),
    };

    await assert.rejects(() =>
      prisma.timelineEvent.create({
        data: constraintInput,
      }),
    );
    await assert.rejects(() =>
      prisma.timelineEvent.create({
        data: {
          ...constraintInput,
          pregnancyId: firstPregnancyId,
          pregnancyFamilyId: firstFamilyId,
          childId: firstChildId,
          childFamilyId: firstFamilyId,
        },
      }),
    );
    await assert.rejects(() =>
      prisma.timelineEvent.create({
        data: {
          ...constraintInput,
          pregnancyId: secondPregnancyId,
          pregnancyFamilyId: firstFamilyId,
        },
      }),
    );
    await assert.rejects(() =>
      prisma.timelineEvent.create({
        data: {
          ...constraintInput,
          childId: secondChildId,
          childFamilyId: secondFamilyId,
        },
      }),
    );

    const orderedRows = [
      {
        id: "timeline-order-a",
        occurredAt: new Date("2026-07-20T10:00:00.000Z"),
        createdAt: new Date("2026-07-21T10:00:00.000Z"),
      },
      {
        id: "timeline-order-b",
        occurredAt: new Date("2026-07-20T10:00:00.000Z"),
        createdAt: new Date("2026-07-21T11:00:00.000Z"),
      },
      {
        id: "timeline-order-c",
        occurredAt: new Date("2026-07-20T10:00:00.000Z"),
        createdAt: new Date("2026-07-21T11:00:00.000Z"),
      },
      {
        id: "timeline-order-d",
        occurredAt: new Date("2026-07-21T10:00:00.000Z"),
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
      },
    ];

    for (const row of orderedRows) {
      await prisma.timelineEvent.create({
        data: {
          ...row,
          familyId: firstFamilyId,
          pregnancyId: orderingPregnancyId,
          pregnancyFamilyId: firstFamilyId,
          title: "Ordering Event",
          updatedAt: row.createdAt,
        },
      });
      createdTimelineEventIds.push(row.id);
    }

    const orderingResponse = await fetch(
      timelineUrl(baseUrl, firstFamilyId, "pregnancies", orderingPregnancyId),
      {
        headers: {
          Cookie: firstUser.cookie,
        },
      },
    );
    const orderingBody = (await orderingResponse.json()) as {
      timelineEvents: TimelineEventResponse[];
    };

    assert.equal(orderingResponse.status, 200);
    assert.deepEqual(
      orderingBody.timelineEvents.map((event) => event.id),
      [
        "timeline-order-d",
        "timeline-order-c",
        "timeline-order-b",
        "timeline-order-a",
      ],
    );

    assert.equal(
      await prisma.timelineEvent.count({
        where: {
          familyId: firstFamilyId,
          title: "First step ✨",
        },
      }),
      2,
    );

    await assert.rejects(() =>
      prisma.pregnancy.delete({
        where: {
          id: firstPregnancyId,
        },
      }),
    );
    await assert.rejects(() =>
      prisma.child.delete({
        where: {
          id: firstChildId,
        },
      }),
    );
    await assert.rejects(() =>
      prisma.family.delete({
        where: {
          id: firstFamilyId,
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
      await prisma.timelineEvent.findUnique({
        where: {
          id: pregnancyEvent.id,
        },
      }),
    );

    const raceFamilyId = await createFamily(
      baseUrl,
      firstUser.cookie,
      "Timeline Race Family",
    );
    createdFamilyIds.push(raceFamilyId);
    const raceChildId = await createSubject(
      baseUrl,
      raceFamilyId,
      firstUser.cookie,
      "children",
      "Timeline Race Child",
    );
    createdSubjectIds.push(raceChildId);
    const raceMembership = await prisma.familyMembership.findUniqueOrThrow({
      where: {
        familyId_userId: {
          familyId: raceFamilyId,
          userId: firstUser.userId,
        },
      },
    });
    const [raceCreate, raceMembershipDelete] = await Promise.allSettled([
      repository.createTimelineEventForMember({
        familyId: raceFamilyId,
        userId: firstUser.userId,
        subject: {
          type: "CHILD",
          childId: raceChildId,
        },
        title: "Concurrent authorization event",
        occurredAt: new Date("2026-07-22T11:10:00.000Z"),
      }),
      prisma.familyMembership.delete({
        where: {
          id: raceMembership.id,
        },
      }),
    ]);

    assert.equal(raceMembershipDelete.status, "fulfilled");
    if (raceCreate.status === "fulfilled" && raceCreate.value) {
      createdTimelineEventIds.push(raceCreate.value.id);
    } else if (raceCreate.status === "rejected") {
      assert.equal((raceCreate.reason as { code?: string }).code, "P2034");
    }
    assert.equal(
      await repository.createTimelineEventForMember({
        familyId: raceFamilyId,
        userId: firstUser.userId,
        subject: {
          type: "CHILD",
          childId: raceChildId,
        },
        title: "Rejected after membership removal",
        occurredAt: new Date("2026-07-22T11:10:00.000Z"),
      }),
      null,
    );
    assert.ok(
      (await prisma.timelineEvent.count({
        where: {
          familyId: raceFamilyId,
        },
      })) <= 1,
    );

    for (const responseText of sensitiveResponseTexts) {
      assert.ok(!responseText.includes(firstPassword));
      assert.ok(!responseText.includes(secondPassword));
      assert.ok(!responseText.includes(firstUser.rawToken));
      assert.ok(!responseText.includes(secondUser.rawToken));
      assert.doesNotMatch(
        responseText,
        /"email"|"name"|"userId"|"role"|"token"|"session"|"account"|"password"|"medicalClassification"/,
      );
    }

    assert.ok(!processOutput.includes(firstPassword));
    assert.ok(!processOutput.includes(secondPassword));
    assert.ok(!processOutput.includes(firstUser.rawToken));
    assert.ok(!processOutput.includes(secondUser.rawToken));
    assert.ok(!processOutput.includes("First step ✨"));
    assert.ok(!processOutput.includes("Private title that must not echo"));
  } finally {
    await stopProcess(apiProcess);

    if (createdFamilyIds.length > 0) {
      await prisma.timelineEvent.deleteMany({
        where: {
          familyId: {
            in: createdFamilyIds,
          },
        },
      });
      await prisma.child.deleteMany({
        where: {
          familyId: {
            in: createdFamilyIds,
          },
        },
      });
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
      await prisma.timelineEvent.count({
        where: {
          id: {
            in: createdTimelineEventIds,
          },
        },
      }),
      0,
    );
    assert.equal(
      await prisma.pregnancy.count({
        where: {
          id: {
            in: createdSubjectIds,
          },
        },
      }),
      0,
    );
    assert.equal(
      await prisma.child.count({
        where: {
          id: {
            in: createdSubjectIds,
          },
        },
      }),
      0,
    );
    await disconnectPrismaClient();
  }
});
