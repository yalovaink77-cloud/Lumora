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
  createPregnancyApiClient,
  type PregnancyApiClient,
} from "./pregnancy-api-client";
import { upsertPregnancySorted } from "./pregnancy-dto";
import {
  PREGNANCY_FAMILY_NOT_FOUND_MESSAGE,
  PREGNANCY_MALFORMED_RESPONSE_MESSAGE,
  PREGNANCY_NETWORK_ERROR_MESSAGE,
  PREGNANCY_NOT_FOUND_MESSAGE,
  PREGNANCY_SERVER_ERROR_MESSAGE,
  messageForPregnancyValidationCode,
} from "./pregnancy-messages";
import {
  applyPregnancyDetailSuccess,
  applyPregnancyDetailUnavailable,
  applyPregnancyListFailure,
  applyPregnancyListSuccess,
  applyPregnancyListUnavailable,
  beginPregnancyDetailLoad,
  beginPregnancyListLoad,
  bindPregnancyPrincipal,
  clearPregnancyMemoryState,
  createInitialPregnancyMemoryState,
  type PregnancyDetailStatus,
  type PregnancyListErrorKind,
  type PregnancyListStatus,
  type PregnancyMemoryState,
} from "./pregnancy-state";
import type {
  MobilePregnancy,
  PregnancyValidationCode,
} from "./pregnancy.types";

export type PregnancyActionResult =
  | { ok: true; pregnancy?: MobilePregnancy }
  | {
      ok: false;
      message: string;
      validationCode?: PregnancyValidationCode;
      familyUnavailable?: boolean;
    };

export type PregnancyContextValue = {
  familyId: string | null;
  pregnancies: MobilePregnancy[];
  listStatus: PregnancyListStatus;
  listErrorMessage: string | null;
  detail: MobilePregnancy | null;
  detailStatus: PregnancyDetailStatus;
  detailErrorMessage: string | null;
  loadPregnancies: (familyId: string) => Promise<void>;
  refreshPregnancies: (familyId: string) => Promise<void>;
  loadPregnancyDetail: (familyId: string, pregnancyId: string) => Promise<void>;
  createPregnancy: (
    familyId: string,
    displayName: string,
  ) => Promise<PregnancyActionResult>;
  clearDetail: () => void;
  clearFamilyContext: () => void;
};

const PregnancyContext = createContext<PregnancyContextValue | null>(null);

function listErrorMessage(
  status: PregnancyListStatus,
  kind: PregnancyListErrorKind,
): string | null {
  if (status === "unavailable") {
    return PREGNANCY_FAMILY_NOT_FOUND_MESSAGE;
  }
  if (kind === "network") {
    return PREGNANCY_NETWORK_ERROR_MESSAGE;
  }
  if (kind === "malformed") {
    return PREGNANCY_MALFORMED_RESPONSE_MESSAGE;
  }
  if (kind === "server") {
    return PREGNANCY_SERVER_ERROR_MESSAGE;
  }
  return null;
}

function detailErrorMessage(
  status: PregnancyDetailStatus,
  kind: PregnancyListErrorKind,
): string | null {
  if (status === "unavailable") {
    return PREGNANCY_NOT_FOUND_MESSAGE;
  }
  return listErrorMessage("error", kind);
}

export function PregnancyProvider({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  const principalId = session.principal?.id ?? null;
  const [state, setState] = useState<PregnancyMemoryState>(
    createInitialPregnancyMemoryState,
  );
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const createAbortRef = useRef<AbortController | null>(null);
  const clientRef = useRef<PregnancyApiClient | null>(null);

  const getClient = (): PregnancyApiClient => {
    if (!clientRef.current) {
      const authClient = getMobileAuthClient();
      clientRef.current = createPregnancyApiClient({
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
    setState(clearPregnancyMemoryState());
    await session.signOut();
  });

  useEffect(() => {
    setState((current) => bindPregnancyPrincipal(current, principalId));
    if (principalId === null) {
      cancelAllRequests();
    }
  }, [principalId]);

  useEffect(() => {
    return () => {
      cancelAllRequests();
    };
  }, []);

  const loadPregnanciesInternal = useEffectEvent(
    async (familyId: string, mode: "loading" | "refreshing") => {
      if (principalId === null || session.status !== "authenticated") {
        return;
      }

      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      let generation = 0;
      setState((current) => {
        const next = beginPregnancyListLoad(current, familyId, mode);
        generation = next.listGeneration;
        return next;
      });

      const result = await getClient().listPregnancies(
        familyId,
        controller.signal,
      );

      setState((current) => {
        if (result.kind === "aborted") {
          return current;
        }

        if (result.kind === "unauthorized") {
          void handleUnauthorized();
          return clearPregnancyMemoryState();
        }

        if (result.kind === "family_not_found") {
          return applyPregnancyListUnavailable(current, {
            principalId: principalId!,
            familyId,
            generation,
          });
        }

        if (result.kind === "ok") {
          return applyPregnancyListSuccess(current, {
            principalId: principalId!,
            familyId,
            generation,
            pregnancies: result.data,
          });
        }

        const listError: PregnancyListErrorKind =
          result.kind === "network"
            ? "network"
            : result.kind === "malformed"
              ? "malformed"
              : "server";

        return applyPregnancyListFailure(current, {
          principalId: principalId!,
          familyId,
          generation,
          error: listError,
        });
      });
    },
  );

  const value: PregnancyContextValue = {
    familyId: state.familyId,
    pregnancies: state.pregnancies,
    listStatus: state.listStatus,
    listErrorMessage: listErrorMessage(state.listStatus, state.listError),
    detail: state.detail,
    detailStatus: state.detailStatus,
    detailErrorMessage: detailErrorMessage(
      state.detailStatus,
      state.detailError,
    ),
    async loadPregnancies(familyId: string) {
      await loadPregnanciesInternal(familyId, "loading");
    },
    async refreshPregnancies(familyId: string) {
      await loadPregnanciesInternal(familyId, "refreshing");
    },
    async loadPregnancyDetail(familyId: string, pregnancyId: string) {
      if (principalId === null || session.status !== "authenticated") {
        return;
      }

      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      let generation = 0;
      setState((current) => {
        const next = beginPregnancyDetailLoad(current, familyId, pregnancyId);
        generation = next.detailGeneration;
        return next;
      });

      const result = await getClient().getPregnancy(
        familyId,
        pregnancyId,
        controller.signal,
      );

      setState((current) => {
        if (result.kind === "aborted") {
          return current;
        }

        if (result.kind === "unauthorized") {
          void handleUnauthorized();
          return clearPregnancyMemoryState();
        }

        if (
          result.kind === "pregnancy_not_found" ||
          result.kind === "family_not_found"
        ) {
          return applyPregnancyDetailUnavailable(current, {
            principalId: principalId!,
            familyId,
            generation,
            pregnancyId,
          });
        }

        if (result.kind === "ok") {
          return applyPregnancyDetailSuccess(current, {
            principalId: principalId!,
            familyId,
            generation,
            pregnancyId,
            pregnancy: result.data,
            upsert: upsertPregnancySorted,
          });
        }

        const detailError: PregnancyListErrorKind =
          result.kind === "network"
            ? "network"
            : result.kind === "malformed"
              ? "malformed"
              : "server";

        if (
          current.principalId !== principalId ||
          current.familyId !== familyId ||
          current.detailGeneration !== generation ||
          current.detailPregnancyId !== pregnancyId
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
    async createPregnancy(familyId: string, displayName: string) {
      if (principalId === null || session.status !== "authenticated") {
        return { ok: false, message: PREGNANCY_SERVER_ERROR_MESSAGE };
      }

      createAbortRef.current?.abort();
      const controller = new AbortController();
      createAbortRef.current = controller;

      const result = await getClient().createPregnancy(
        familyId,
        { displayName },
        controller.signal,
      );

      if (result.kind === "aborted") {
        return { ok: false, message: PREGNANCY_NETWORK_ERROR_MESSAGE };
      }

      if (result.kind === "unauthorized") {
        await handleUnauthorized();
        return { ok: false, message: PREGNANCY_SERVER_ERROR_MESSAGE };
      }

      if (result.kind === "family_not_found") {
        return {
          ok: false,
          message: PREGNANCY_FAMILY_NOT_FOUND_MESSAGE,
          familyUnavailable: true,
        };
      }

      if (result.kind === "validation") {
        return {
          ok: false,
          message: messageForPregnancyValidationCode(result.code),
          validationCode: result.code,
        };
      }

      if (result.kind !== "ok") {
        return {
          ok: false,
          message:
            result.kind === "network"
              ? PREGNANCY_NETWORK_ERROR_MESSAGE
              : result.kind === "malformed"
                ? PREGNANCY_MALFORMED_RESPONSE_MESSAGE
                : PREGNANCY_SERVER_ERROR_MESSAGE,
        };
      }

      await loadPregnanciesInternal(familyId, "loading");

      if (
        session.status !== "authenticated" ||
        session.principal?.id !== principalId
      ) {
        return { ok: false, message: PREGNANCY_SERVER_ERROR_MESSAGE };
      }

      setState((current) => {
        if (
          current.principalId !== principalId ||
          current.familyId !== familyId
        ) {
          return current;
        }

        return {
          ...current,
          pregnancies: upsertPregnancySorted(current.pregnancies, result.data),
          detail: result.data,
          detailPregnancyId: result.data.id,
          detailStatus: "ready",
          detailError: null,
        };
      });

      return { ok: true, pregnancy: result.data };
    },
    clearDetail() {
      detailAbortRef.current?.abort();
      setState((current) => ({
        ...current,
        detailPregnancyId: null,
        detail: null,
        detailStatus: "idle",
        detailError: null,
      }));
    },
    clearFamilyContext() {
      cancelAllRequests();
      setState((current) => ({
        ...createInitialPregnancyMemoryState(),
        principalId: current.principalId,
      }));
    },
  };

  return (
    <PregnancyContext.Provider value={value}>
      {children}
    </PregnancyContext.Provider>
  );
}

export function usePregnancyStore(): PregnancyContextValue {
  const value = useContext(PregnancyContext);
  if (!value) {
    throw new Error("usePregnancyStore must be used within PregnancyProvider.");
  }
  return value;
}
