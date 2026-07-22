import type { NeutralAuthenticatedPrincipal } from "./neutral-principal";

/**
 * Client shell auth states for Sprint 2.9B.2.
 * ADR-019 authenticated-entry disclosure is deferred to Sprint 2.9B.3.
 */
export type ShellAuthStatus =
  "bootstrapping" | "unauthenticated" | "authenticated" | "error";

export type ShellErrorKind = "config" | "network";

export type ShellSessionState = {
  status: ShellAuthStatus;
  principal: NeutralAuthenticatedPrincipal | null;
  errorKind: ShellErrorKind | null;
};

export type ShellRouteGroup = "root" | "auth" | "app";

export type ShellRedirectTarget =
  { kind: "stay" } | { kind: "replace"; href: "/(auth)/sign-in" | "/(app)" };

export function createInitialShellSessionState(): ShellSessionState {
  return {
    status: "bootstrapping",
    principal: null,
    errorKind: null,
  };
}

export function toBootstrappingState(): ShellSessionState {
  return createInitialShellSessionState();
}

export function toUnauthenticatedState(): ShellSessionState {
  return {
    status: "unauthenticated",
    principal: null,
    errorKind: null,
  };
}

export function toAuthenticatedState(
  principal: NeutralAuthenticatedPrincipal,
): ShellSessionState {
  return {
    status: "authenticated",
    principal,
    errorKind: null,
  };
}

export function toErrorState(errorKind: ShellErrorKind): ShellSessionState {
  return {
    status: "error",
    principal: null,
    errorKind,
  };
}

/**
 * Route-group guard decisions for Expo Router layouts.
 * Authenticated users may enter Home; disclosure gating is Sprint 2.9B.3.
 */
export function resolveShellRedirect(input: {
  status: ShellAuthStatus;
  group: ShellRouteGroup;
}): ShellRedirectTarget {
  const { status, group } = input;

  if (status === "bootstrapping" || status === "error") {
    return { kind: "stay" };
  }

  if (status === "unauthenticated") {
    if (group === "app") {
      return { kind: "replace", href: "/(auth)/sign-in" };
    }
    if (group === "root") {
      return { kind: "replace", href: "/(auth)/sign-in" };
    }
    return { kind: "stay" };
  }

  // authenticated
  if (group === "auth" || group === "root") {
    return { kind: "replace", href: "/(app)" };
  }

  return { kind: "stay" };
}
