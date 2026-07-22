import type { MobileChild } from "./child.types";

export type ChildListStatus =
  "idle" | "loading" | "ready" | "refreshing" | "error" | "unavailable";

export type ChildDetailStatus =
  "idle" | "loading" | "ready" | "unavailable" | "error";

export type ChildListErrorKind = "network" | "server" | "malformed" | null;

export type ChildMemoryState = {
  principalId: string | null;
  familyId: string | null;
  children: MobileChild[];
  listStatus: ChildListStatus;
  listError: ChildListErrorKind;
  detailChildId: string | null;
  detail: MobileChild | null;
  detailStatus: ChildDetailStatus;
  detailError: ChildListErrorKind;
  listGeneration: number;
  detailGeneration: number;
};

export function createInitialChildMemoryState(): ChildMemoryState {
  return {
    principalId: null,
    familyId: null,
    children: [],
    listStatus: "idle",
    listError: null,
    detailChildId: null,
    detail: null,
    detailStatus: "idle",
    detailError: null,
    listGeneration: 0,
    detailGeneration: 0,
  };
}

export function clearChildMemoryState(): ChildMemoryState {
  return createInitialChildMemoryState();
}

export function bindChildPrincipal(
  state: ChildMemoryState,
  principalId: string | null,
): ChildMemoryState {
  if (state.principalId === principalId) {
    return state;
  }

  return {
    ...createInitialChildMemoryState(),
    principalId,
  };
}

/** Isolates or clears state when Family route context changes. */
export function bindChildFamilyContext(
  state: ChildMemoryState,
  familyId: string | null,
): ChildMemoryState {
  if (state.familyId === familyId) {
    return state;
  }

  return {
    ...createInitialChildMemoryState(),
    principalId: state.principalId,
    familyId,
  };
}

export function beginChildListLoad(
  state: ChildMemoryState,
  familyId: string,
  mode: "loading" | "refreshing",
): ChildMemoryState {
  const scoped =
    state.familyId === familyId
      ? state
      : bindChildFamilyContext(state, familyId);

  return {
    ...scoped,
    listGeneration: scoped.listGeneration + 1,
    listStatus: mode,
    listError: null,
  };
}

export function applyChildListSuccess(
  state: ChildMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
    children: MobileChild[];
  },
): ChildMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.listGeneration !== input.generation
  ) {
    return state;
  }

  return {
    ...state,
    children: input.children,
    listStatus: "ready",
    listError: null,
  };
}

export function applyChildListFailure(
  state: ChildMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
    error: Exclude<ChildListErrorKind, null>;
  },
): ChildMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.listGeneration !== input.generation
  ) {
    return state;
  }

  return {
    ...state,
    listStatus: "error",
    listError: input.error,
  };
}

export function applyChildListUnavailable(
  state: ChildMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
  },
): ChildMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.listGeneration !== input.generation
  ) {
    return state;
  }

  return {
    ...state,
    children: [],
    listStatus: "unavailable",
    listError: null,
  };
}

export function beginChildDetailLoad(
  state: ChildMemoryState,
  familyId: string,
  childId: string,
): ChildMemoryState {
  const scoped =
    state.familyId === familyId
      ? state
      : bindChildFamilyContext(state, familyId);

  return {
    ...scoped,
    detailGeneration: scoped.detailGeneration + 1,
    detailChildId: childId,
    detail: null,
    detailStatus: "loading",
    detailError: null,
  };
}

export function applyChildDetailSuccess(
  state: ChildMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
    childId: string;
    child: MobileChild;
    upsert: (
      children: readonly MobileChild[],
      child: MobileChild,
    ) => MobileChild[];
  },
): ChildMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.detailGeneration !== input.generation ||
    state.detailChildId !== input.childId
  ) {
    return state;
  }

  return {
    ...state,
    detail: input.child,
    detailStatus: "ready",
    detailError: null,
    children: input.upsert(state.children, input.child),
  };
}

export function applyChildDetailUnavailable(
  state: ChildMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
    childId: string;
  },
): ChildMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.detailGeneration !== input.generation ||
    state.detailChildId !== input.childId
  ) {
    return state;
  }

  return {
    ...state,
    detail: null,
    detailStatus: "unavailable",
    detailError: null,
  };
}

/**
 * Synchronizes list and detail after a successful displayName mutation.
 * Uses the server-returned DTO, including refreshed updatedAt for same-value updates.
 */
export function applyChildDisplayNameUpdate(
  state: ChildMemoryState,
  input: {
    principalId: string;
    familyId: string;
    childId: string;
    child: MobileChild;
    upsert: (
      children: readonly MobileChild[],
      child: MobileChild,
    ) => MobileChild[];
  },
): ChildMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId
  ) {
    return state;
  }

  const matchesDetail =
    state.detailChildId === input.childId || state.detail?.id === input.childId;

  return {
    ...state,
    children: input.upsert(state.children, input.child),
    detail: matchesDetail ? input.child : state.detail,
    detailChildId: matchesDetail ? input.childId : state.detailChildId,
    detailStatus: matchesDetail ? "ready" : state.detailStatus,
    detailError: matchesDetail ? null : state.detailError,
  };
}
