import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { createTimelineApiClient } from "./timeline-api-client";
import { TIMELINE_API_TIMEOUT_MS } from "./timeline.types";

const pregnancyEvent = {
  id: "evt_1",
  familyId: "fam_1",
  pregnancyId: "preg_1",
  title: "Note",
  occurredAt: "2026-07-22T11:10:00.123Z",
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

const childEvent = {
  id: "evt_2",
  familyId: "fam_1",
  childId: "child_1",
  title: "Step",
  occurredAt: "2026-07-21T09:00:00.000Z",
  createdAt: "2026-07-21T10:00:00.000Z",
  updatedAt: "2026-07-21T10:00:00.000Z",
};

type MockCall = {
  url: string;
  init: RequestInit | undefined;
};

function createMockFetch(handler: (call: MockCall) => Promise<Response>) {
  const calls: MockCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : String(input);
    const call = { url, init };
    calls.push(call);
    return handler(call);
  };
  return { fetchImpl, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("Pregnancy list/create/get encode paths and map DTOs", async () => {
  const { fetchImpl, calls } = createMockFetch(async (call) => {
    if (call.init?.method === "POST") {
      return jsonResponse(201, pregnancyEvent);
    }
    if (call.url.includes("/timeline-events/evt")) {
      return jsonResponse(200, pregnancyEvent);
    }
    return jsonResponse(200, { timelineEvents: [pregnancyEvent] });
  });
  const client = createTimelineApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl,
  });

  assert.deepEqual(
    await client.listPregnancyTimelineEvents("fam_1", "preg_1"),
    {
      kind: "ok",
      data: [pregnancyEvent],
    },
  );
  assert.match(
    calls[0]?.url ?? "",
    /\/families\/fam_1\/pregnancies\/preg_1\/timeline-events$/,
  );
  assert.equal(calls[0]?.init?.credentials, "omit");

  const created = await client.createPregnancyTimelineEvent("fam_1", "preg_1", {
    title: "  Note  ",
    occurredAt: "2026-07-22T11:10:00.123Z",
  });
  assert.deepEqual(created, { kind: "ok", data: pregnancyEvent });
  assert.equal(
    calls.find((call) => call.init?.method === "POST")?.init?.body,
    JSON.stringify({
      title: "Note",
      occurredAt: "2026-07-22T11:10:00.123Z",
    }),
  );

  assert.deepEqual(
    await client.getPregnancyTimelineEvent("fam_1", "preg_1", "evt/1"),
    { kind: "ok", data: pregnancyEvent },
  );
  assert.match(calls.at(-1)?.url ?? "", /timeline-events\/evt%2F1$/);
});

test("Child list/create/get succeed and reject cross-subject DTOs", async () => {
  const client = createTimelineApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(200, { timelineEvents: [childEvent] }),
  });
  assert.deepEqual(await client.listChildTimelineEvents("fam_1", "child_1"), {
    kind: "ok",
    data: [childEvent],
  });

  const createClient = createTimelineApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(201, childEvent),
  });
  assert.deepEqual(
    await createClient.createChildTimelineEvent("fam_1", "child_1", {
      title: "Step",
      occurredAt: "2026-07-21T09:00:00.000Z",
    }),
    { kind: "ok", data: childEvent },
  );

  const mismatched = createTimelineApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(201, pregnancyEvent),
  });
  assert.deepEqual(
    await mismatched.createChildTimelineEvent("fam_1", "child_1", {
      title: "Step",
      occurredAt: "2026-07-21T09:00:00.000Z",
    }),
    { kind: "malformed" },
  );
});

test("maps unauthorized, TIMELINE_NOT_FOUND, validation, timeout", async () => {
  const unauthorized = createTimelineApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => new Response(null, { status: 401 }),
  });
  assert.deepEqual(
    await unauthorized.listPregnancyTimelineEvents("fam_1", "preg_1"),
    { kind: "unauthorized" },
  );

  const missing = createTimelineApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () =>
      jsonResponse(404, {
        code: "TIMELINE_NOT_FOUND",
        message: "Timeline resource not found.",
      }),
  });
  assert.deepEqual(
    await missing.getChildTimelineEvent("fam_1", "child_1", "missing"),
    { kind: "timeline_not_found" },
  );

  const validation = createTimelineApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(400, { code: "TITLE_TOO_LONG" }),
  });
  assert.deepEqual(
    await validation.createPregnancyTimelineEvent("fam_1", "preg_1", {
      title: "Ok",
      occurredAt: "2026-07-22T11:10:00.000Z",
    }),
    { kind: "validation", code: "TITLE_TOO_LONG" },
  );

  assert.equal(TIMELINE_API_TIMEOUT_MS, 15_000);
  const timeout = createTimelineApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    timeoutMs: 20,
    fetchImpl: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });
  assert.deepEqual(
    await timeout.listPregnancyTimelineEvents("fam_1", "preg_1"),
    { kind: "aborted" },
  );
});

test("API client does not log Timeline titles or payloads", () => {
  const source = readFileSync(
    join(process.cwd(), "src/timeline/timeline-api-client.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(source, /Authorization:\s*['"]Bearer/);
  assert.match(source, /credentials: "omit"/);
  assert.match(source, /encodeURIComponent\(familyId\)/);
});
