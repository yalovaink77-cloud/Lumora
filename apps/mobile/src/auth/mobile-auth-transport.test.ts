import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { InvalidApiBaseUrlError } from "../config/api-base-url";
import { toNeutralPrincipal } from "./neutral-principal";
import {
  LUMORA_APP_SCHEME,
  LUMORA_AUTH_STORAGE_PREFIX,
  clearMobileAuthSecureStore,
  resolveMobileAuthTransportConfig,
  type SecureStoreLike,
} from "./mobile-auth-transport";

function createMemorySecureStore(): SecureStoreLike & {
  entries: Map<string, string>;
} {
  const entries = new Map<string, string>();

  return {
    entries,
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    },
    async deleteItemAsync(key: string) {
      entries.delete(key);
    },
  };
}

test("resolveMobileAuthTransportConfig uses approved scheme and Lumora prefix", () => {
  assert.deepEqual(
    resolveMobileAuthTransportConfig({
      apiBaseUrl: "https://api.lumora.example",
      requireHttps: true,
    }),
    {
      baseURL: "https://api.lumora.example",
      scheme: "lumora",
      storagePrefix: "lumora",
      cookiePrefix: "better-auth",
    },
  );
  assert.equal(LUMORA_APP_SCHEME, "lumora");
  assert.equal(LUMORA_AUTH_STORAGE_PREFIX, "lumora");
});

test("resolveMobileAuthTransportConfig rejects invalid API base URL without echoing it", () => {
  try {
    resolveMobileAuthTransportConfig({
      apiBaseUrl: "http://api.lumora.example",
      requireHttps: true,
    });
    assert.fail("expected invalid API base URL rejection");
  } catch (error) {
    assert.equal(error instanceof InvalidApiBaseUrlError, true);
    assert.doesNotMatch(String(error), /api\.lumora\.example/);
  }
});

test("neutral principal mapping keeps only approved identity fields", () => {
  const principal = toNeutralPrincipal({
    id: "user_1",
    email: "member@example.test",
    emailVerified: true,
    name: "Member",
  });

  assert.deepEqual(Object.keys(principal).sort(), [
    "email",
    "emailVerified",
    "id",
    "name",
  ]);
  assert.deepEqual(principal, {
    id: "user_1",
    email: "member@example.test",
    emailVerified: true,
    name: "Member",
  });
});

test("clearMobileAuthSecureStore removes only provided namespaced keys", async () => {
  const secureStore = createMemorySecureStore();
  secureStore.setItem("lumora_cookie", "opaque");
  secureStore.setItem("unrelated", "keep");

  await clearMobileAuthSecureStore(secureStore, ["lumora_cookie"]);

  assert.equal(secureStore.getItem("lumora_cookie"), null);
  assert.equal(secureStore.getItem("unrelated"), "keep");
  assert.doesNotMatch(
    JSON.stringify([...secureStore.entries.values()]),
    /opaque/,
  );
});

test("mobile auth composition sources use Expo SecureStore transport without JWT/roles", () => {
  const transportSource = readFileSync(
    join(process.cwd(), "src/auth/mobile-auth-transport.ts"),
    "utf8",
  );
  const clientSource = readFileSync(
    join(process.cwd(), "src/auth/create-mobile-auth-client.ts"),
    "utf8",
  );

  assert.match(clientSource, /expoClient/);
  assert.match(clientSource, /createAuthClient/);
  assert.match(clientSource, /storagePrefix: transport.storagePrefix/);
  assert.match(clientSource, /cookiePrefix: transport.cookiePrefix/);
  assert.doesNotMatch(clientSource, /AsyncStorage/);
  assert.doesNotMatch(clientSource, /jsonwebtoken|customJwt/);
  assert.doesNotMatch(clientSource, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(transportSource, /role|permission|OWNER|MEMBER/);
  assert.doesNotMatch(clientSource, /role|permission|OWNER|MEMBER/);
});
