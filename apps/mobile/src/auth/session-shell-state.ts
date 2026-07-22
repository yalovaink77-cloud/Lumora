import type { NeutralAuthenticatedPrincipal } from "./neutral-principal";
import {
  hasContinuedDisclosure,
  type DisclosureProcessState,
} from "./disclosure-process-state";

/**
 * Client shell auth states including ADR-019 authenticated-entry disclosure.
 */
export type ShellAuthStatus =
  | "bootstrapping"
  | "unauthenticated"
  | "authenticated-entry"
  | "authenticated"
  | "error";

export type ShellErrorKind = "config" | "network";

export type ShellSessionState = {
  status: ShellAuthStatus;
  principal: NeutralAuthenticatedPrincipal | null;
  errorKind: ShellErrorKind | null;
};

export type ShellRouteGroup = "root" | "auth" | "entry" | "app";

export type ShellRedirectHref = "/(auth)/sign-in" | "/disclosure" | "/(app)";

export type ShellRedirectTarget =
  { kind: "stay" } | { kind: "replace"; href: ShellRedirectHref };

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

export function toAuthenticatedEntryState(
  principal: NeutralAuthenticatedPrincipal,
): ShellSessionState {
  return {
    status: "authenticated-entry",
    principal,
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
 * Maps a validated principal + in-memory disclosure flag to shell status.
 * Disclosure continuation is never stored on the principal.
 */
export function resolveAuthenticatedShellState(
  principal: NeutralAuthenticatedPrincipal,
  disclosure: DisclosureProcessState,
): ShellSessionState {
  if (hasContinuedDisclosure(disclosure, principal.id)) {
    return toAuthenticatedState(principal);
  }

  return toAuthenticatedEntryState(principal);
}

/**
 * Route-group guard decisions for Expo Router layouts.
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
    if (group === "auth") {
      return { kind: "stay" };
    }

    return { kind: "replace", href: "/(auth)/sign-in" };
  }

  if (status === "authenticated-entry") {
    if (group === "entry") {
      return { kind: "stay" };
    }

    return { kind: "replace", href: "/disclosure" };
  }

  // authenticated — disclosure continued for this process lifetime
  if (group === "auth" || group === "root" || group === "entry") {
    return { kind: "replace", href: "/(app)" };
  }

  return { kind: "stay" };
}
