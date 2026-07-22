import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { createFamilyApiClient } from "./family-api-client";
import { FAMILY_API_TIMEOUT_MS } from "./family.types";

const family = {
  id: "fam_1",
  displayName: "Ada Family",
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

test("listFamilies maps success and empty list", async () => {
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(200, { families: [family] }),
  );
  const client = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "better-auth.session_token=opaque",
    fetchImpl,
  });

  const result = await client.listFamilies();
  assert.deepEqual(result, { kind: "ok", data: [family] });
  assert.equal(calls[0]?.url, "https://api.lumora.example/families");
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal(
    (calls[0]?.init?.headers as Record<string, string>).Cookie,
    "better-auth.session_token=opaque",
  );
  assert.equal(calls[0]?.init?.credentials, "omit");
  assert.doesNotMatch(JSON.stringify(calls[0]?.init?.headers), /Bearer|JWT/i);

  const emptyClient = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "",
    fetchImpl: async () => jsonResponse(200, { families: [] }),
  });
  assert.deepEqual(await emptyClient.listFamilies(), {
    kind: "ok",
    data: [],
  });
});

test("createFamily maps success DTO and ignores membership role storage", async () => {
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(201, {
      family,
      membership: {
        id: "mem_1",
        familyId: family.id,
        userId: "user_1",
        role: "OWNER",
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      },
    }),
  );
  const client = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example/",
    getCookie: () => "cookie",
    fetchImpl,
  });

  const result = await client.createFamily({ displayName: "  Ada Family  " });
  assert.deepEqual(result, { kind: "ok", data: family });
  assert.equal(calls[0]?.url, "https://api.lumora.example/families");
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({ displayName: "Ada Family" }),
  );
});

test("getFamily encodes familyId and maps success", async () => {
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(200, family),
  );
  const client = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl,
  });

  const result = await client.getFamily("fam/with spaces");
  assert.deepEqual(result, { kind: "ok", data: family });
  assert.equal(
    calls[0]?.url,
    "https://api.lumora.example/families/fam%2Fwith%20spaces",
  );
});

test("API client maps unauthorized, not_found, validation, malformed", async () => {
  const unauthorized = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => new Response(null, { status: 401 }),
  });
  assert.deepEqual(await unauthorized.listFamilies(), { kind: "unauthorized" });

  const notFound = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () =>
      jsonResponse(404, {
        statusCode: 404,
        code: "FAMILY_NOT_FOUND",
        message: "Family not found.",
      }),
  });
  assert.deepEqual(await notFound.getFamily("missing"), { kind: "not_found" });

  const validation = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(400, { code: "DISPLAY_NAME_TOO_LONG" }),
  });
  assert.deepEqual(await validation.createFamily({ displayName: "Ok" }), {
    kind: "validation",
    code: "DISPLAY_NAME_TOO_LONG",
  });

  const malformed = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(200, { unexpected: true }),
  });
  assert.deepEqual(await malformed.listFamilies(), { kind: "malformed" });
});

test("API client maps retryable network failure", async () => {
  const client = createFamilyApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => {
      throw new TypeError("network down");
    },
  });
  assert.deepEqual(await client.listFamilies(), { kind: "network" });
});

test("API client times out with AbortError mapping", async () => {
  const client = createFamilyApiClient({
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

  assert.equal(FAMILY_API_TIMEOUT_MS, 15_000);
  assert.deepEqual(await client.listFamilies(), { kind: "aborted" });
});

test("API client honors external cancellation", async () => {
  const controller = new AbortController();
  const client = createFamilyApiClient({
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

  const pending = client.getFamily("fam_1", controller.signal);
  controller.abort();
  assert.deepEqual(await pending, { kind: "aborted" });
});

test("API client does not log Family names or payloads", () => {
  const source = readFileSync(
    join(process.cwd(), "src/family/family-api-client.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(source, /Authorization:\s*['"]Bearer/);
});
