import type { MobilePregnancy } from "./pregnancy.types";

export type PregnancyListStatus =
  "idle" | "loading" | "ready" | "refreshing" | "error" | "unavailable";

export type PregnancyDetailStatus =
  "idle" | "loading" | "ready" | "unavailable" | "error";

export type PregnancyListErrorKind = "network" | "server" | "malformed" | null;

export type PregnancyMemoryState = {
  principalId: string | null;
  familyId: string | null;
  pregnancies: MobilePregnancy[];
  listStatus: PregnancyListStatus;
  listError: PregnancyListErrorKind;
  detailPregnancyId: string | null;
  detail: MobilePregnancy | null;
  detailStatus: PregnancyDetailStatus;
  detailError: PregnancyListErrorKind;
  listGeneration: number;
  detailGeneration: number;
};

export function createInitialPregnancyMemoryState(): PregnancyMemoryState {
  return {
    principalId: null,
    familyId: null,
    pregnancies: [],
    listStatus: "idle",
    listError: null,
    detailPregnancyId: null,
    detail: null,
    detailStatus: "idle",
    detailError: null,
    listGeneration: 0,
    detailGeneration: 0,
  };
}

export function clearPregnancyMemoryState(): PregnancyMemoryState {
  return createInitialPregnancyMemoryState();
}

export function bindPregnancyPrincipal(
  state: PregnancyMemoryState,
  principalId: string | null,
): PregnancyMemoryState {
  if (state.principalId === principalId) {
    return state;
  }

  return {
    ...createInitialPregnancyMemoryState(),
    principalId,
  };
}

/** Isolates or clears state when Family route context changes. */
export function bindPregnancyFamilyContext(
  state: PregnancyMemoryState,
  familyId: string | null,
): PregnancyMemoryState {
  if (state.familyId === familyId) {
    return state;
  }

  return {
    ...createInitialPregnancyMemoryState(),
    principalId: state.principalId,
    familyId,
  };
}

export function beginPregnancyListLoad(
  state: PregnancyMemoryState,
  familyId: string,
  mode: "loading" | "refreshing",
): PregnancyMemoryState {
  const scoped =
    state.familyId === familyId
      ? state
      : bindPregnancyFamilyContext(state, familyId);

  return {
    ...scoped,
    listGeneration: scoped.listGeneration + 1,
    listStatus: mode,
    listError: null,
  };
}

export function applyPregnancyListSuccess(
  state: PregnancyMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
    pregnancies: MobilePregnancy[];
  },
): PregnancyMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.listGeneration !== input.generation
  ) {
    return state;
  }

  return {
    ...state,
    pregnancies: input.pregnancies,
    listStatus: "ready",
    listError: null,
  };
}

export function applyPregnancyListFailure(
  state: PregnancyMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
    error: Exclude<PregnancyListErrorKind, null>;
  },
): PregnancyMemoryState {
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

export function applyPregnancyListUnavailable(
  state: PregnancyMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
  },
): PregnancyMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.listGeneration !== input.generation
  ) {
    return state;
  }

  return {
    ...state,
    pregnancies: [],
    listStatus: "unavailable",
    listError: null,
  };
}

export function beginPregnancyDetailLoad(
  state: PregnancyMemoryState,
  familyId: string,
  pregnancyId: string,
): PregnancyMemoryState {
  const scoped =
    state.familyId === familyId
      ? state
      : bindPregnancyFamilyContext(state, familyId);

  return {
    ...scoped,
    detailGeneration: scoped.detailGeneration + 1,
    detailPregnancyId: pregnancyId,
    detail: null,
    detailStatus: "loading",
    detailError: null,
  };
}

export function applyPregnancyDetailSuccess(
  state: PregnancyMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
    pregnancyId: string;
    pregnancy: MobilePregnancy;
    upsert: (
      pregnancies: readonly MobilePregnancy[],
      pregnancy: MobilePregnancy,
    ) => MobilePregnancy[];
  },
): PregnancyMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.detailGeneration !== input.generation ||
    state.detailPregnancyId !== input.pregnancyId
  ) {
    return state;
  }

  return {
    ...state,
    detail: input.pregnancy,
    detailStatus: "ready",
    detailError: null,
    pregnancies: input.upsert(state.pregnancies, input.pregnancy),
  };
}

export function applyPregnancyDetailUnavailable(
  state: PregnancyMemoryState,
  input: {
    principalId: string;
    familyId: string;
    generation: number;
    pregnancyId: string;
  },
): PregnancyMemoryState {
  if (
    state.principalId !== input.principalId ||
    state.familyId !== input.familyId ||
    state.detailGeneration !== input.generation ||
    state.detailPregnancyId !== input.pregnancyId
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
