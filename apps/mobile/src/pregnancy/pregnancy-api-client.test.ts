import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { createPregnancyApiClient } from "./pregnancy-api-client";
import { PREGNANCY_API_TIMEOUT_MS } from "./pregnancy.types";

const pregnancy = {
  id: "preg_1",
  familyId: "fam_1",
  displayName: "Journey",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
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

test("listPregnancies maps success and empty list with encoded familyId", async () => {
  const encodedFamilyId = "fam/with spaces";
  const scopedPregnancy = { ...pregnancy, familyId: encodedFamilyId };
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(200, { pregnancies: [scopedPregnancy] }),
  );
  const client = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "better-auth.session_token=opaque",
    fetchImpl,
  });

  const result = await client.listPregnancies(encodedFamilyId);
  assert.deepEqual(result, { kind: "ok", data: [scopedPregnancy] });
  assert.equal(
    calls[0]?.url,
    "https://api.lumora.example/families/fam%2Fwith%20spaces/pregnancies",
  );
  assert.equal(calls[0]?.init?.credentials, "omit");
  assert.doesNotMatch(JSON.stringify(calls[0]?.init?.headers), /Bearer /i);

  const empty = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "",
    fetchImpl: async () => jsonResponse(200, { pregnancies: [] }),
  });
  assert.deepEqual(await empty.listPregnancies("fam_1"), {
    kind: "ok",
    data: [],
  });
});

test("createPregnancy maps success DTO and enforces familyId consistency", async () => {
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(201, pregnancy),
  );
  const client = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example/",
    getCookie: () => "cookie",
    fetchImpl,
  });

  const result = await client.createPregnancy("fam_1", {
    displayName: "  Journey  ",
  });
  assert.deepEqual(result, { kind: "ok", data: pregnancy });
  assert.equal(
    calls[0]?.url,
    "https://api.lumora.example/families/fam_1/pregnancies",
  );
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({ displayName: "Journey" }),
  );

  const mismatched = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () =>
      jsonResponse(201, { ...pregnancy, familyId: "other" }),
  });
  assert.deepEqual(
    await mismatched.createPregnancy("fam_1", { displayName: "Journey" }),
    { kind: "malformed" },
  );
});

test("getPregnancy encodes ids and maps success", async () => {
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(200, pregnancy),
  );
  const client = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl,
  });

  const result = await client.getPregnancy("fam_1", "preg/with spaces");
  assert.deepEqual(result, { kind: "ok", data: pregnancy });
  assert.equal(
    calls[0]?.url,
    "https://api.lumora.example/families/fam_1/pregnancies/preg%2Fwith%20spaces",
  );
});

test("API client maps unauthorized, family_not_found, pregnancy_not_found, validation", async () => {
  const unauthorized = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => new Response(null, { status: 401 }),
  });
  assert.deepEqual(await unauthorized.listPregnancies("fam_1"), {
    kind: "unauthorized",
  });

  const familyMissing = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () =>
      jsonResponse(404, {
        code: "FAMILY_NOT_FOUND",
        message: "Family not found.",
      }),
  });
  assert.deepEqual(await familyMissing.listPregnancies("missing"), {
    kind: "family_not_found",
  });

  const pregnancyMissing = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () =>
      jsonResponse(404, {
        code: "PREGNANCY_NOT_FOUND",
        message: "Pregnancy not found.",
      }),
  });
  assert.deepEqual(await pregnancyMissing.getPregnancy("fam_1", "missing"), {
    kind: "pregnancy_not_found",
  });

  const validation = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(400, { code: "DISPLAY_NAME_TOO_LONG" }),
  });
  assert.deepEqual(
    await validation.createPregnancy("fam_1", { displayName: "Ok" }),
    { kind: "validation", code: "DISPLAY_NAME_TOO_LONG" },
  );
});

test("API client maps network failure, timeout, and cancellation", async () => {
  const network = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => {
      throw new TypeError("network down");
    },
  });
  assert.deepEqual(await network.listPregnancies("fam_1"), {
    kind: "network",
  });

  assert.equal(PREGNANCY_API_TIMEOUT_MS, 15_000);
  const timeout = createPregnancyApiClient({
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
  assert.deepEqual(await timeout.listPregnancies("fam_1"), {
    kind: "aborted",
  });

  const controller = new AbortController();
  const cancellable = createPregnancyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });
  const pending = cancellable.getPregnancy(
    "fam_1",
    "preg_1",
    controller.signal,
  );
  controller.abort();
  assert.deepEqual(await pending, { kind: "aborted" });
});

test("API client does not log Pregnancy names or payloads", () => {
  const source = readFileSync(
    join(process.cwd(), "src/pregnancy/pregnancy-api-client.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(source, /Authorization:\s*['"]Bearer/);
});
