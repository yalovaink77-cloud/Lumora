import type {
  MobileTimelineEvent,
  TimelineSubjectType,
} from "./timeline.types";

export type TimelineListStatus =
  "idle" | "loading" | "ready" | "refreshing" | "error" | "unavailable";

export type TimelineDetailStatus =
  "idle" | "loading" | "ready" | "unavailable" | "error";

export type TimelineListErrorKind = "network" | "server" | "malformed" | null;

export type TimelineSubjectKey = {
  familyId: string;
  subjectType: TimelineSubjectType;
  subjectId: string;
};

export type TimelineMemoryState = {
  principalId: string | null;
  familyId: string | null;
  subjectType: TimelineSubjectType | null;
  subjectId: string | null;
  events: MobileTimelineEvent[];
  listStatus: TimelineListStatus;
  listError: TimelineListErrorKind;
  detailEventId: string | null;
  detail: MobileTimelineEvent | null;
  detailStatus: TimelineDetailStatus;
  detailError: TimelineListErrorKind;
  listGeneration: number;
  detailGeneration: number;
};

export function createInitialTimelineMemoryState(): TimelineMemoryState {
  return {
    principalId: null,
    familyId: null,
    subjectType: null,
    subjectId: null,
    events: [],
    listStatus: "idle",
    listError: null,
    detailEventId: null,
    detail: null,
    detailStatus: "idle",
    detailError: null,
    listGeneration: 0,
    detailGeneration: 0,
  };
}

export function clearTimelineMemoryState(): TimelineMemoryState {
  return createInitialTimelineMemoryState();
}

export function bindTimelinePrincipal(
  state: TimelineMemoryState,
  principalId: string | null,
): TimelineMemoryState {
  if (state.principalId === principalId) {
    return state;
  }

  return {
    ...createInitialTimelineMemoryState(),
    principalId,
  };
}

export function bindTimelineSubjectContext(
  state: TimelineMemoryState,
  subject: TimelineSubjectKey | null,
): TimelineMemoryState {
  if (
    subject !== null &&
    state.familyId === subject.familyId &&
    state.subjectType === subject.subjectType &&
    state.subjectId === subject.subjectId
  ) {
    return state;
  }

  return {
    ...createInitialTimelineMemoryState(),
    principalId: state.principalId,
    familyId: subject?.familyId ?? null,
    subjectType: subject?.subjectType ?? null,
    subjectId: subject?.subjectId ?? null,
  };
}

function sameSubject(
  state: TimelineMemoryState,
  subject: TimelineSubjectKey,
): boolean {
  return (
    state.familyId === subject.familyId &&
    state.subjectType === subject.subjectType &&
    state.subjectId === subject.subjectId
  );
}

export function beginTimelineListLoad(
  state: TimelineMemoryState,
  subject: TimelineSubjectKey,
  mode: "loading" | "refreshing",
): TimelineMemoryState {
  const scoped = sameSubject(state, subject)
    ? state
    : bindTimelineSubjectContext(state, subject);

  return {
    ...scoped,
    listGeneration: scoped.listGeneration + 1,
    listStatus: mode,
    listError: null,
  };
}

export function applyTimelineListSuccess(
  state: TimelineMemoryState,
  input: {
    principalId: string;
    subject: TimelineSubjectKey;
    generation: number;
    events: MobileTimelineEvent[];
  },
): TimelineMemoryState {
  if (
    state.principalId !== input.principalId ||
    !sameSubject(state, input.subject) ||
    state.listGeneration !== input.generation
  ) {
    return state;
  }

  return {
    ...state,
    events: input.events,
    listStatus: "ready",
    listError: null,
  };
}

export function applyTimelineListFailure(
  state: TimelineMemoryState,
  input: {
    principalId: string;
    subject: TimelineSubjectKey;
    generation: number;
    error: Exclude<TimelineListErrorKind, null>;
  },
): TimelineMemoryState {
  if (
    state.principalId !== input.principalId ||
    !sameSubject(state, input.subject) ||
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

export function applyTimelineListUnavailable(
  state: TimelineMemoryState,
  input: {
    principalId: string;
    subject: TimelineSubjectKey;
    generation: number;
  },
): TimelineMemoryState {
  if (
    state.principalId !== input.principalId ||
    !sameSubject(state, input.subject) ||
    state.listGeneration !== input.generation
  ) {
    return state;
  }

  return {
    ...state,
    events: [],
    listStatus: "unavailable",
    listError: null,
  };
}

export function beginTimelineDetailLoad(
  state: TimelineMemoryState,
  subject: TimelineSubjectKey,
  eventId: string,
): TimelineMemoryState {
  const scoped = sameSubject(state, subject)
    ? state
    : bindTimelineSubjectContext(state, subject);

  return {
    ...scoped,
    detailGeneration: scoped.detailGeneration + 1,
    detailEventId: eventId,
    detail: null,
    detailStatus: "loading",
    detailError: null,
  };
}

export function applyTimelineDetailSuccess(
  state: TimelineMemoryState,
  input: {
    principalId: string;
    subject: TimelineSubjectKey;
    generation: number;
    eventId: string;
    event: MobileTimelineEvent;
    upsert: (
      events: readonly MobileTimelineEvent[],
      event: MobileTimelineEvent,
    ) => MobileTimelineEvent[];
  },
): TimelineMemoryState {
  if (
    state.principalId !== input.principalId ||
    !sameSubject(state, input.subject) ||
    state.detailGeneration !== input.generation ||
    state.detailEventId !== input.eventId
  ) {
    return state;
  }

  return {
    ...state,
    detail: input.event,
    detailStatus: "ready",
    detailError: null,
    events: input.upsert(state.events, input.event),
  };
}

export function applyTimelineDetailUnavailable(
  state: TimelineMemoryState,
  input: {
    principalId: string;
    subject: TimelineSubjectKey;
    generation: number;
    eventId: string;
  },
): TimelineMemoryState {
  if (
    state.principalId !== input.principalId ||
    !sameSubject(state, input.subject) ||
    state.detailGeneration !== input.generation ||
    state.detailEventId !== input.eventId
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
