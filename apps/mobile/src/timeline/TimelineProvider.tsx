import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuthSession } from "../auth/auth-session-context";
import {
  getMobileApiBaseUrl,
  getMobileAuthClient,
} from "../auth/mobile-auth-client";
import {
  createTimelineApiClient,
  type TimelineApiClient,
} from "./timeline-api-client";
import { upsertTimelineEventSorted } from "./timeline-dto";
import {
  TIMELINE_MALFORMED_RESPONSE_MESSAGE,
  TIMELINE_NETWORK_ERROR_MESSAGE,
  TIMELINE_NOT_FOUND_MESSAGE,
  TIMELINE_SERVER_ERROR_MESSAGE,
  messageForTimelineValidationCode,
} from "./timeline-messages";
import {
  applyTimelineDetailSuccess,
  applyTimelineDetailUnavailable,
  applyTimelineListFailure,
  applyTimelineListSuccess,
  applyTimelineListUnavailable,
  beginTimelineDetailLoad,
  beginTimelineListLoad,
  bindTimelinePrincipal,
  clearTimelineMemoryState,
  createInitialTimelineMemoryState,
  type TimelineDetailStatus,
  type TimelineListErrorKind,
  type TimelineListStatus,
  type TimelineMemoryState,
  type TimelineSubjectKey,
} from "./timeline-state";
import type {
  MobileTimelineEvent,
  TimelineApiResult,
  TimelineSubjectType,
  TimelineValidationCode,
} from "./timeline.types";

export type TimelineActionResult =
  | { ok: true; event?: MobileTimelineEvent }
  | {
      ok: false;
      message: string;
      validationCode?: TimelineValidationCode;
      unavailable?: boolean;
    };

export type TimelineContextValue = {
  familyId: string | null;
  subjectType: TimelineSubjectType | null;
  subjectId: string | null;
  events: MobileTimelineEvent[];
  listStatus: TimelineListStatus;
  listErrorMessage: string | null;
  detail: MobileTimelineEvent | null;
  detailStatus: TimelineDetailStatus;
  detailErrorMessage: string | null;
  loadPregnancyTimeline: (
    familyId: string,
    pregnancyId: string,
  ) => Promise<void>;
  refreshPregnancyTimeline: (
    familyId: string,
    pregnancyId: string,
  ) => Promise<void>;
  loadPregnancyTimelineEvent: (
    familyId: string,
    pregnancyId: string,
    timelineEventId: string,
  ) => Promise<void>;
  createPregnancyTimelineEvent: (
    familyId: string,
    pregnancyId: string,
    title: string,
    occurredAt: string,
  ) => Promise<TimelineActionResult>;
  loadChildTimeline: (familyId: string, childId: string) => Promise<void>;
  refreshChildTimeline: (familyId: string, childId: string) => Promise<void>;
  loadChildTimelineEvent: (
    familyId: string,
    childId: string,
    timelineEventId: string,
  ) => Promise<void>;
  createChildTimelineEvent: (
    familyId: string,
    childId: string,
    title: string,
    occurredAt: string,
  ) => Promise<TimelineActionResult>;
  clearDetail: () => void;
  clearSubjectContext: () => void;
};

const TimelineContext = createContext<TimelineContextValue | null>(null);

function listErrorMessage(
  status: TimelineListStatus,
  kind: TimelineListErrorKind,
): string | null {
  if (status === "unavailable") {
    return TIMELINE_NOT_FOUND_MESSAGE;
  }
  if (kind === "network") {
    return TIMELINE_NETWORK_ERROR_MESSAGE;
  }
  if (kind === "malformed") {
    return TIMELINE_MALFORMED_RESPONSE_MESSAGE;
  }
  if (kind === "server") {
    return TIMELINE_SERVER_ERROR_MESSAGE;
  }
  return null;
}

function detailErrorMessage(
  status: TimelineDetailStatus,
  kind: TimelineListErrorKind,
): string | null {
  if (status === "unavailable") {
    return TIMELINE_NOT_FOUND_MESSAGE;
  }
  return listErrorMessage("error", kind);
}

export function TimelineProvider({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  const principalId = session.principal?.id ?? null;
  const [state, setState] = useState<TimelineMemoryState>(
    createInitialTimelineMemoryState,
  );
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const createAbortRef = useRef<AbortController | null>(null);
  const clientRef = useRef<TimelineApiClient | null>(null);

  const getClient = (): TimelineApiClient => {
    if (!clientRef.current) {
      const authClient = getMobileAuthClient();
      clientRef.current = createTimelineApiClient({
        apiBaseUrl: getMobileApiBaseUrl(),
        getCookie: () => authClient.getCookie(),
      });
    }
    return clientRef.current;
  };

  const cancelAllRequests = useEffectEvent(() => {
    listAbortRef.current?.abort();
    detailAbortRef.current?.abort();
    createAbortRef.current?.abort();
    listAbortRef.current = null;
    detailAbortRef.current = null;
    createAbortRef.current = null;
  });

  const handleUnauthorized = useEffectEvent(async () => {
    cancelAllRequests();
    setState(clearTimelineMemoryState());
    await session.signOut();
  });

  useEffect(() => {
    setState((current) => bindTimelinePrincipal(current, principalId));
    if (principalId === null) {
      cancelAllRequests();
    }
  }, [principalId]);

  useEffect(() => {
    return () => {
      cancelAllRequests();
    };
  }, []);

  const loadListInternal = useEffectEvent(
    async (
      subject: TimelineSubjectKey,
      mode: "loading" | "refreshing",
      list: () => Promise<TimelineApiResult<MobileTimelineEvent[]>>,
    ) => {
      if (principalId === null || session.status !== "authenticated") {
        return;
      }

      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      let generation = 0;
      setState((current) => {
        const next = beginTimelineListLoad(current, subject, mode);
        generation = next.listGeneration;
        return next;
      });

      const result = await list();

      setState((current) => {
        if (result.kind === "aborted") {
          return current;
        }

        if (result.kind === "unauthorized") {
          void handleUnauthorized();
          return clearTimelineMemoryState();
        }

        if (result.kind === "timeline_not_found") {
          return applyTimelineListUnavailable(current, {
            principalId: principalId!,
            subject,
            generation,
          });
        }

        if (result.kind === "ok") {
          return applyTimelineListSuccess(current, {
            principalId: principalId!,
            subject,
            generation,
            events: result.data,
          });
        }

        const listError: TimelineListErrorKind =
          result.kind === "network"
            ? "network"
            : result.kind === "malformed"
              ? "malformed"
              : "server";

        return applyTimelineListFailure(current, {
          principalId: principalId!,
          subject,
          generation,
          error: listError,
        });
      });
    },
  );

  const loadDetailInternal = useEffectEvent(
    async (
      subject: TimelineSubjectKey,
      timelineEventId: string,
      get: () => Promise<TimelineApiResult<MobileTimelineEvent>>,
    ) => {
      if (principalId === null || session.status !== "authenticated") {
        return;
      }

      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      let generation = 0;
      setState((current) => {
        const next = beginTimelineDetailLoad(current, subject, timelineEventId);
        generation = next.detailGeneration;
        return next;
      });

      const result = await get();

      setState((current) => {
        if (result.kind === "aborted") {
          return current;
        }

        if (result.kind === "unauthorized") {
          void handleUnauthorized();
          return clearTimelineMemoryState();
        }

        if (result.kind === "timeline_not_found") {
          return applyTimelineDetailUnavailable(current, {
            principalId: principalId!,
            subject,
            generation,
            eventId: timelineEventId,
          });
        }

        if (result.kind === "ok") {
          return applyTimelineDetailSuccess(current, {
            principalId: principalId!,
            subject,
            generation,
            eventId: timelineEventId,
            event: result.data,
            upsert: upsertTimelineEventSorted,
          });
        }

        const detailError: TimelineListErrorKind =
          result.kind === "network"
            ? "network"
            : result.kind === "malformed"
              ? "malformed"
              : "server";

        if (
          current.principalId !== principalId ||
          current.familyId !== subject.familyId ||
          current.subjectType !== subject.subjectType ||
          current.subjectId !== subject.subjectId ||
          current.detailGeneration !== generation ||
          current.detailEventId !== timelineEventId
        ) {
          return current;
        }

        return {
          ...current,
          detail: null,
          detailStatus: "error",
          detailError,
        };
      });
    },
  );

  const createInternal = useEffectEvent(
    async (
      subject: TimelineSubjectKey,
      title: string,
      occurredAt: string,
      create: () => Promise<TimelineApiResult<MobileTimelineEvent>>,
      reload: () => Promise<void>,
    ): Promise<TimelineActionResult> => {
      if (principalId === null || session.status !== "authenticated") {
        return { ok: false, message: TIMELINE_SERVER_ERROR_MESSAGE };
      }

      createAbortRef.current?.abort();
      const controller = new AbortController();
      createAbortRef.current = controller;

      const result = await create();

      if (result.kind === "aborted") {
        return { ok: false, message: TIMELINE_NETWORK_ERROR_MESSAGE };
      }

      if (result.kind === "unauthorized") {
        await handleUnauthorized();
        return { ok: false, message: TIMELINE_SERVER_ERROR_MESSAGE };
      }

      if (result.kind === "timeline_not_found") {
        return {
          ok: false,
          message: TIMELINE_NOT_FOUND_MESSAGE,
          unavailable: true,
        };
      }

      if (result.kind === "validation") {
        return {
          ok: false,
          message: messageForTimelineValidationCode(result.code),
          validationCode: result.code,
        };
      }

      if (result.kind !== "ok") {
        return {
          ok: false,
          message:
            result.kind === "network"
              ? TIMELINE_NETWORK_ERROR_MESSAGE
              : result.kind === "malformed"
                ? TIMELINE_MALFORMED_RESPONSE_MESSAGE
                : TIMELINE_SERVER_ERROR_MESSAGE,
        };
      }

      await reload();

      if (
        session.status !== "authenticated" ||
        session.principal?.id !== principalId
      ) {
        return { ok: false, message: TIMELINE_SERVER_ERROR_MESSAGE };
      }

      setState((current) => {
        if (
          current.principalId !== principalId ||
          current.familyId !== subject.familyId ||
          current.subjectType !== subject.subjectType ||
          current.subjectId !== subject.subjectId
        ) {
          return current;
        }

        return {
          ...current,
          events: upsertTimelineEventSorted(current.events, result.data),
          detail: result.data,
          detailEventId: result.data.id,
          detailStatus: "ready",
          detailError: null,
        };
      });

      return { ok: true, event: result.data };
    },
  );

  const value: TimelineContextValue = {
    familyId: state.familyId,
    subjectType: state.subjectType,
    subjectId: state.subjectId,
    events: state.events,
    listStatus: state.listStatus,
    listErrorMessage: listErrorMessage(state.listStatus, state.listError),
    detail: state.detail,
    detailStatus: state.detailStatus,
    detailErrorMessage: detailErrorMessage(
      state.detailStatus,
      state.detailError,
    ),
    async loadPregnancyTimeline(familyId, pregnancyId) {
      const subject: TimelineSubjectKey = {
        familyId,
        subjectType: "pregnancy",
        subjectId: pregnancyId,
      };
      await loadListInternal(subject, "loading", () =>
        getClient().listPregnancyTimelineEvents(
          familyId,
          pregnancyId,
          listAbortRef.current!.signal,
        ),
      );
    },
    async refreshPregnancyTimeline(familyId, pregnancyId) {
      const subject: TimelineSubjectKey = {
        familyId,
        subjectType: "pregnancy",
        subjectId: pregnancyId,
      };
      await loadListInternal(subject, "refreshing", () =>
        getClient().listPregnancyTimelineEvents(
          familyId,
          pregnancyId,
          listAbortRef.current!.signal,
        ),
      );
    },
    async loadPregnancyTimelineEvent(familyId, pregnancyId, timelineEventId) {
      const subject: TimelineSubjectKey = {
        familyId,
        subjectType: "pregnancy",
        subjectId: pregnancyId,
      };
      await loadDetailInternal(subject, timelineEventId, () =>
        getClient().getPregnancyTimelineEvent(
          familyId,
          pregnancyId,
          timelineEventId,
          detailAbortRef.current!.signal,
        ),
      );
    },
    async createPregnancyTimelineEvent(
      familyId,
      pregnancyId,
      title,
      occurredAt,
    ) {
      const subject: TimelineSubjectKey = {
        familyId,
        subjectType: "pregnancy",
        subjectId: pregnancyId,
      };
      return createInternal(
        subject,
        title,
        occurredAt,
        () =>
          getClient().createPregnancyTimelineEvent(
            familyId,
            pregnancyId,
            { title, occurredAt },
            createAbortRef.current!.signal,
          ),
        async () => {
          await loadListInternal(subject, "loading", () =>
            getClient().listPregnancyTimelineEvents(
              familyId,
              pregnancyId,
              listAbortRef.current!.signal,
            ),
          );
        },
      );
    },
    async loadChildTimeline(familyId, childId) {
      const subject: TimelineSubjectKey = {
        familyId,
        subjectType: "child",
        subjectId: childId,
      };
      await loadListInternal(subject, "loading", () =>
        getClient().listChildTimelineEvents(
          familyId,
          childId,
          listAbortRef.current!.signal,
        ),
      );
    },
    async refreshChildTimeline(familyId, childId) {
      const subject: TimelineSubjectKey = {
        familyId,
        subjectType: "child",
        subjectId: childId,
      };
      await loadListInternal(subject, "refreshing", () =>
        getClient().listChildTimelineEvents(
          familyId,
          childId,
          listAbortRef.current!.signal,
        ),
      );
    },
    async loadChildTimelineEvent(familyId, childId, timelineEventId) {
      const subject: TimelineSubjectKey = {
        familyId,
        subjectType: "child",
        subjectId: childId,
      };
      await loadDetailInternal(subject, timelineEventId, () =>
        getClient().getChildTimelineEvent(
          familyId,
          childId,
          timelineEventId,
          detailAbortRef.current!.signal,
        ),
      );
    },
    async createChildTimelineEvent(familyId, childId, title, occurredAt) {
      const subject: TimelineSubjectKey = {
        familyId,
        subjectType: "child",
        subjectId: childId,
      };
      return createInternal(
        subject,
        title,
        occurredAt,
        () =>
          getClient().createChildTimelineEvent(
            familyId,
            childId,
            { title, occurredAt },
            createAbortRef.current!.signal,
          ),
        async () => {
          await loadListInternal(subject, "loading", () =>
            getClient().listChildTimelineEvents(
              familyId,
              childId,
              listAbortRef.current!.signal,
            ),
          );
        },
      );
    },
    clearDetail() {
      detailAbortRef.current?.abort();
      setState((current) => ({
        ...current,
        detailEventId: null,
        detail: null,
        detailStatus: "idle",
        detailError: null,
      }));
    },
    clearSubjectContext() {
      cancelAllRequests();
      setState((current) => ({
        ...createInitialTimelineMemoryState(),
        principalId: current.principalId,
      }));
    },
  };

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimelineStore(): TimelineContextValue {
  const value = useContext(TimelineContext);
  if (!value) {
    throw new Error("useTimelineStore must be used within TimelineProvider.");
  }
  return value;
}
