import type { MobileFamily } from "./family.types";

export type FamilyListStatus =
  "idle" | "loading" | "ready" | "refreshing" | "error";

export type FamilyDetailStatus =
  "idle" | "loading" | "ready" | "unavailable" | "error";

export type FamilyListErrorKind = "network" | "server" | "malformed" | null;

export type FamilyMemoryState = {
  principalId: string | null;
  families: MobileFamily[];
  listStatus: FamilyListStatus;
  listError: FamilyListErrorKind;
  detailFamilyId: string | null;
  detail: MobileFamily | null;
  detailStatus: FamilyDetailStatus;
  detailError: FamilyListErrorKind;
  listGeneration: number;
  detailGeneration: number;
};

export function createInitialFamilyMemoryState(): FamilyMemoryState {
  return {
    principalId: null,
    families: [],
    listStatus: "idle",
    listError: null,
    detailFamilyId: null,
    detail: null,
    detailStatus: "idle",
    detailError: null,
    listGeneration: 0,
    detailGeneration: 0,
  };
}

export function clearFamilyMemoryState(): FamilyMemoryState {
  return createInitialFamilyMemoryState();
}

export function bindFamilyPrincipal(
  state: FamilyMemoryState,
  principalId: string | null,
): FamilyMemoryState {
  if (state.principalId === principalId) {
    return state;
  }

  return {
    ...createInitialFamilyMemoryState(),
    principalId,
  };
}

/** Marks a list request generation; used for stale-response protection. */
export function beginFamilyListLoad(
  state: FamilyMemoryState,
  mode: "loading" | "refreshing",
): FamilyMemoryState {
  return {
    ...state,
    listGeneration: state.listGeneration + 1,
    listStatus: mode,
    listError: null,
  };
}

export function applyFamilyListSuccess(
  state: FamilyMemoryState,
  input: {
    principalId: string;
    generation: number;
    families: MobileFamily[];
  },
): FamilyMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.listGeneration !== input.generation
  ) {
    return state;
  }

  return {
    ...state,
    families: input.families,
    listStatus: "ready",
    listError: null,
  };
}

export function applyFamilyListFailure(
  state: FamilyMemoryState,
  input: {
    principalId: string;
    generation: number;
    error: Exclude<FamilyListErrorKind, null>;
  },
): FamilyMemoryState {
  if (
    state.principalId !== input.principalId ||
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

export function beginFamilyDetailLoad(
  state: FamilyMemoryState,
  familyId: string,
): FamilyMemoryState {
  return {
    ...state,
    detailGeneration: state.detailGeneration + 1,
    detailFamilyId: familyId,
    detail: null,
    detailStatus: "loading",
    detailError: null,
  };
}

export function applyFamilyDetailSuccess(
  state: FamilyMemoryState,
  input: {
    principalId: string;
    generation: number;
    familyId: string;
    family: MobileFamily;
    upsert: (
      families: readonly MobileFamily[],
      family: MobileFamily,
    ) => MobileFamily[];
  },
): FamilyMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.detailGeneration !== input.generation ||
    state.detailFamilyId !== input.familyId
  ) {
    return state;
  }

  return {
    ...state,
    detail: input.family,
    detailStatus: "ready",
    detailError: null,
    families: input.upsert(state.families, input.family),
  };
}

export function applyFamilyDetailUnavailable(
  state: FamilyMemoryState,
  input: {
    principalId: string;
    generation: number;
    familyId: string;
  },
): FamilyMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.detailGeneration !== input.generation ||
    state.detailFamilyId !== input.familyId
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
