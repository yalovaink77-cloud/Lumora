import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInitialShellSessionState,
  resolveShellRedirect,
  toAuthenticatedState,
  toErrorState,
  toUnauthenticatedState,
} from "./session-shell-state";

test("initial shell state is bootstrapping without principal", () => {
  assert.deepEqual(createInitialShellSessionState(), {
    status: "bootstrapping",
    principal: null,
    errorKind: null,
  });
});

test("unauthenticated users are kept out of the app group", () => {
  assert.deepEqual(
    resolveShellRedirect({ status: "unauthenticated", group: "app" }),
    { kind: "replace", href: "/(auth)/sign-in" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "unauthenticated", group: "auth" }),
    { kind: "stay" },
  );
});

test("authenticated users are kept out of the auth group and enter Home", () => {
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated", group: "auth" }),
    { kind: "replace", href: "/(app)" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated", group: "app" }),
    { kind: "stay" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated", group: "root" }),
    { kind: "replace", href: "/(app)" },
  );
});

test("bootstrapping and error states do not navigate", () => {
  assert.deepEqual(
    resolveShellRedirect({ status: "bootstrapping", group: "root" }),
    { kind: "stay" },
  );
  assert.deepEqual(resolveShellRedirect({ status: "error", group: "app" }), {
    kind: "stay",
  });
});

test("authenticated state stores only the neutral principal", () => {
  const state = toAuthenticatedState({
    id: "user_1",
    email: "member@example.test",
    emailVerified: false,
    name: "Member",
  });

  assert.equal(state.status, "authenticated");
  assert.deepEqual(Object.keys(state.principal ?? {}).sort(), [
    "email",
    "emailVerified",
    "id",
    "name",
  ]);
  assert.equal(toUnauthenticatedState().principal, null);
  assert.equal(toErrorState("network").errorKind, "network");
});
