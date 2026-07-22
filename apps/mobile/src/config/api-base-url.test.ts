import assert from "node:assert/strict";
import { test } from "node:test";

import {
  InvalidApiBaseUrlError,
  parseApiBaseUrl,
  resolveApiBaseUrlFromEnv,
} from "./api-base-url";

test("accepts valid HTTPS API base URL and strips trailing slash", () => {
  assert.equal(
    parseApiBaseUrl("https://api.lumora.example/", { requireHttps: true }),
    "https://api.lumora.example",
  );
});

test("accepts approved local HTTP development URLs", () => {
  assert.equal(
    parseApiBaseUrl("http://localhost:3000", { requireHttps: false }),
    "http://localhost:3000",
  );
  assert.equal(
    parseApiBaseUrl("http://127.0.0.1:3000", { requireHttps: false }),
    "http://127.0.0.1:3000",
  );
  assert.equal(
    parseApiBaseUrl("http://10.0.2.2:3000", { requireHttps: false }),
    "http://10.0.2.2:3000",
  );
  assert.equal(
    parseApiBaseUrl("http://192.168.1.20:3000", { requireHttps: false }),
    "http://192.168.1.20:3000",
  );
});

test("rejects missing, malformed, credential, query, fragment, and path URLs", () => {
  for (const value of [
    undefined,
    "",
    "not-a-url",
    "https://user:pass@api.lumora.example",
    "https://api.lumora.example?x=1",
    "https://api.lumora.example#frag",
    "https://api.lumora.example/api",
    "ftp://api.lumora.example",
  ]) {
    assert.throws(
      () => parseApiBaseUrl(value, { requireHttps: false }),
      InvalidApiBaseUrlError,
    );
  }
});

test("production/release mode rejects HTTP even for localhost", () => {
  assert.throws(
    () => parseApiBaseUrl("http://localhost:3000", { requireHttps: true }),
    InvalidApiBaseUrlError,
  );
});

test("rejects non-local HTTP hosts in development", () => {
  assert.throws(
    () => parseApiBaseUrl("http://api.lumora.example", { requireHttps: false }),
    InvalidApiBaseUrlError,
  );
});

test("resolveApiBaseUrlFromEnv fails closed without secrets or fallbacks", () => {
  assert.throws(
    () => resolveApiBaseUrlFromEnv({ NODE_ENV: "development" }),
    InvalidApiBaseUrlError,
  );
  assert.equal(
    resolveApiBaseUrlFromEnv({
      NODE_ENV: "development",
      EXPO_PUBLIC_LUMORA_API_BASE_URL: "http://localhost:3000",
    }),
    "http://localhost:3000",
  );
  assert.throws(
    () =>
      resolveApiBaseUrlFromEnv({
        NODE_ENV: "production",
        EXPO_PUBLIC_LUMORA_API_BASE_URL: "http://localhost:3000",
      }),
    InvalidApiBaseUrlError,
  );
});

test("validation errors do not echo the configured URL", () => {
  try {
    parseApiBaseUrl("https://secret-host.example?token=abc", {
      requireHttps: true,
    });
    assert.fail("expected validation failure");
  } catch (error) {
    assert.equal(error instanceof InvalidApiBaseUrlError, true);
    assert.doesNotMatch(String(error), /secret-host|token=abc/);
  }
});
