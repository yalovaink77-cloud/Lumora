import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchNeutralPrincipal,
  mapAuthMeResponse,
} from "./fetch-neutral-principal";

test("mapAuthMeResponse keeps only neutral principal fields", () => {
  const principal = mapAuthMeResponse({
    id: "user_1",
    email: "member@example.test",
    emailVerified: true,
    name: "Member",
    role: "OWNER",
    permission: "family:write",
    familyId: "fam_1",
  });

  assert.deepEqual(principal, {
    id: "user_1",
    email: "member@example.test",
    emailVerified: true,
    name: "Member",
  });
  assert.deepEqual(Object.keys(principal ?? {}).sort(), [
    "email",
    "emailVerified",
    "id",
    "name",
  ]);
});

test("mapAuthMeResponse rejects malformed bodies", () => {
  assert.equal(mapAuthMeResponse(null), null);
  assert.equal(mapAuthMeResponse({ id: "user_1" }), null);
  assert.equal(
    mapAuthMeResponse({
      id: 1,
      email: "member@example.test",
      emailVerified: true,
      name: "Member",
    }),
    null,
  );
});

test("fetchNeutralPrincipal returns unauthorized on HTTP 401", async () => {
  const result = await fetchNeutralPrincipal({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "better-auth.session_token=opaque",
    fetchImpl: async () =>
      new Response("unauthorized", {
        status: 401,
      }),
  });

  assert.deepEqual(result, { kind: "unauthorized" });
});

test("fetchNeutralPrincipal returns principal on success without logging cookie", async () => {
  const result = await fetchNeutralPrincipal({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "better-auth.session_token=opaque-secret",
    fetchImpl: async (input, init) => {
      assert.equal(String(input), "https://api.lumora.example/auth/me");
      assert.equal(init?.credentials, "omit");
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        "better-auth.session_token=opaque-secret",
      );
      return Response.json({
        id: "user_1",
        email: "member@example.test",
        emailVerified: false,
        name: "Member",
      });
    },
  });

  assert.deepEqual(result, {
    kind: "ok",
    principal: {
      id: "user_1",
      email: "member@example.test",
      emailVerified: false,
      name: "Member",
    },
  });
});

test("fetchNeutralPrincipal returns error on network failure", async () => {
  const result = await fetchNeutralPrincipal({
    apiBaseUrl: "https://api.lumora.example",
    getCookie: () => "",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  assert.deepEqual(result, { kind: "error" });
});
