import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInitialDisclosureProcessState,
  continueDisclosureForPrincipal,
  resetDisclosureProcessState,
} from "./disclosure-process-state";
import {
  createInitialShellSessionState,
  resolveAuthenticatedShellState,
  resolveShellRedirect,
  toAuthenticatedState,
  toErrorState,
  toUnauthenticatedState,
} from "./session-shell-state";

const principal = {
  id: "user_1",
  email: "member@example.test",
  emailVerified: false,
  name: "Member",
};

test("initial shell state is bootstrapping without principal", () => {
  assert.deepEqual(createInitialShellSessionState(), {
    status: "bootstrapping",
    principal: null,
    errorKind: null,
  });
});

test("unauthenticated users are kept out of app, entry, and root", () => {
  assert.deepEqual(
    resolveShellRedirect({ status: "unauthenticated", group: "app" }),
    { kind: "replace", href: "/(auth)/sign-in" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "unauthenticated", group: "entry" }),
    { kind: "replace", href: "/(auth)/sign-in" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "unauthenticated", group: "auth" }),
    { kind: "stay" },
  );
});

test("authenticated-entry blocks Home and Safety and routes to disclosure", () => {
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated-entry", group: "app" }),
    { kind: "replace", href: "/disclosure" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated-entry", group: "root" }),
    { kind: "replace", href: "/disclosure" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated-entry", group: "auth" }),
    { kind: "replace", href: "/disclosure" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated-entry", group: "entry" }),
    { kind: "stay" },
  );
});

test("authenticated users may stay in app and leave auth/entry/root", () => {
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated", group: "auth" }),
    { kind: "replace", href: "/(app)" },
  );
  assert.deepEqual(
    resolveShellRedirect({ status: "authenticated", group: "entry" }),
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

test("validated principal without continuation is authenticated-entry", () => {
  const state = resolveAuthenticatedShellState(
    principal,
    createInitialDisclosureProcessState(),
  );
  assert.equal(state.status, "authenticated-entry");
  assert.deepEqual(state.principal, principal);
});

test("continuation for the same principal unlocks authenticated Home", () => {
  const state = resolveAuthenticatedShellState(
    principal,
    continueDisclosureForPrincipal(principal.id),
  );
  assert.equal(state.status, "authenticated");
});

test("principal change does not inherit prior continuation", () => {
  const state = resolveAuthenticatedShellState(
    { ...principal, id: "user_2" },
    continueDisclosureForPrincipal("user_1"),
  );
  assert.equal(state.status, "authenticated-entry");
  assert.deepEqual(resetDisclosureProcessState(), {
    continuedForPrincipalId: null,
  });
});

test("authenticated state stores only the neutral principal", () => {
  const state = toAuthenticatedState(principal);

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
