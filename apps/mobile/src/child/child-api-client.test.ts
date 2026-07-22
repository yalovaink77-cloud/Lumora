import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { createChildApiClient } from "./child-api-client";
import { CHILD_API_TIMEOUT_MS } from "./child.types";

const child = {
  id: "child_1",
  familyId: "fam_1",
  displayName: "Ada",
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

test("listChildren maps success and empty list with encoded familyId", async () => {
  const encodedFamilyId = "fam/with spaces";
  const scopedChild = { ...child, familyId: encodedFamilyId };
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(200, { children: [scopedChild] }),
  );
  const client = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "better-auth.session_token=opaque",
    fetchImpl,
  });

  const result = await client.listChildren(encodedFamilyId);
  assert.deepEqual(result, { kind: "ok", data: [scopedChild] });
  assert.equal(
    calls[0]?.url,
    "https://api.lumora.example/families/fam%2Fwith%20spaces/children",
  );
  assert.equal(calls[0]?.init?.credentials, "omit");
  assert.doesNotMatch(JSON.stringify(calls[0]?.init?.headers), /Bearer /i);

  const empty = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "",
    fetchImpl: async () => jsonResponse(200, { children: [] }),
  });
  assert.deepEqual(await empty.listChildren("fam_1"), {
    kind: "ok",
    data: [],
  });
});

test("createChild maps success DTO and enforces familyId consistency", async () => {
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(201, child),
  );
  const client = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example/",
    getCookie: () => "cookie",
    fetchImpl,
  });

  const result = await client.createChild("fam_1", {
    displayName: "  Ada  ",
  });
  assert.deepEqual(result, { kind: "ok", data: child });
  assert.equal(
    calls[0]?.url,
    "https://api.lumora.example/families/fam_1/children",
  );
  assert.equal(calls[0]?.init?.body, JSON.stringify({ displayName: "Ada" }));

  const mismatched = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(201, { ...child, familyId: "other" }),
  });
  assert.deepEqual(
    await mismatched.createChild("fam_1", { displayName: "Ada" }),
    { kind: "malformed" },
  );
});

test("getChild encodes ids and maps success", async () => {
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(200, child),
  );
  const client = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl,
  });

  const result = await client.getChild("fam_1", "child/with spaces");
  assert.deepEqual(result, { kind: "ok", data: child });
  assert.equal(
    calls[0]?.url,
    "https://api.lumora.example/families/fam_1/children/child%2Fwith%20spaces",
  );
});

test("updateChildDisplayName PATCHes displayName and accepts same-value refresh", async () => {
  const refreshed = {
    ...child,
    updatedAt: "2026-01-04T00:00:00.000Z",
  };
  const { fetchImpl, calls } = createMockFetch(async () =>
    jsonResponse(200, refreshed),
  );
  const client = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl,
  });

  const result = await client.updateChildDisplayName("fam_1", "child_1", {
    displayName: "Ada",
  });
  assert.deepEqual(result, { kind: "ok", data: refreshed });
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.equal(
    calls[0]?.url,
    "https://api.lumora.example/families/fam_1/children/child_1",
  );
  assert.equal(calls[0]?.init?.body, JSON.stringify({ displayName: "Ada" }));
});

test("API client maps unauthorized, family_not_found, child_not_found, validation", async () => {
  const unauthorized = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => new Response(null, { status: 401 }),
  });
  assert.deepEqual(await unauthorized.listChildren("fam_1"), {
    kind: "unauthorized",
  });

  const familyMissing = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () =>
      jsonResponse(404, {
        code: "FAMILY_NOT_FOUND",
        message: "Family not found.",
      }),
  });
  assert.deepEqual(await familyMissing.listChildren("missing"), {
    kind: "family_not_found",
  });

  const childMissing = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () =>
      jsonResponse(404, {
        code: "CHILD_NOT_FOUND",
        message: "Child not found.",
      }),
  });
  assert.deepEqual(await childMissing.getChild("fam_1", "missing"), {
    kind: "child_not_found",
  });
  assert.deepEqual(
    await childMissing.updateChildDisplayName("fam_1", "missing", {
      displayName: "Ada",
    }),
    { kind: "child_not_found" },
  );

  const validation = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => jsonResponse(400, { code: "DISPLAY_NAME_TOO_LONG" }),
  });
  assert.deepEqual(
    await validation.createChild("fam_1", { displayName: "Ok" }),
    { kind: "validation", code: "DISPLAY_NAME_TOO_LONG" },
  );
});

test("API client maps network failure, timeout, and cancellation", async () => {
  const network = createChildApiClient({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "cookie",
    fetchImpl: async () => {
      throw new TypeError("network down");
    },
  });
  assert.deepEqual(await network.listChildren("fam_1"), {
    kind: "network",
  });

  assert.equal(CHILD_API_TIMEOUT_MS, 15_000);
  const timeout = createChildApiClient({
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
  assert.deepEqual(await timeout.listChildren("fam_1"), {
    kind: "aborted",
  });

  const controller = new AbortController();
  const cancellable = createChildApiClient({
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
  const pending = cancellable.getChild("fam_1", "child_1", controller.signal);
  controller.abort();
  assert.deepEqual(await pending, { kind: "aborted" });
});

test("API client does not log Child names or payloads", () => {
  const source = readFileSync(
    join(process.cwd(), "src/child/child-api-client.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(source, /Authorization:\s*['"]Bearer/);
});
