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
  createFamilyApiClient,
  type FamilyApiClient,
} from "./family-api-client";
import { upsertFamilySorted } from "./family-dto";
import {
  FAMILY_MALFORMED_RESPONSE_MESSAGE,
  FAMILY_NETWORK_ERROR_MESSAGE,
  FAMILY_NOT_FOUND_MESSAGE,
  FAMILY_SERVER_ERROR_MESSAGE,
  messageForFamilyValidationCode,
} from "./family-messages";
import {
  applyFamilyDetailSuccess,
  applyFamilyDetailUnavailable,
  applyFamilyListFailure,
  applyFamilyListSuccess,
  beginFamilyDetailLoad,
  beginFamilyListLoad,
  bindFamilyPrincipal,
  clearFamilyMemoryState,
  createInitialFamilyMemoryState,
  type FamilyDetailStatus,
  type FamilyListErrorKind,
  type FamilyListStatus,
  type FamilyMemoryState,
} from "./family-state";
import type { FamilyValidationCode, MobileFamily } from "./family.types";

export type FamilyActionResult =
  | { ok: true; family?: MobileFamily }
  | { ok: false; message: string; validationCode?: FamilyValidationCode };

export type FamilyContextValue = {
  families: MobileFamily[];
  listStatus: FamilyListStatus;
  listErrorMessage: string | null;
  detail: MobileFamily | null;
  detailStatus: FamilyDetailStatus;
  detailErrorMessage: string | null;
  loadFamilies: () => Promise<void>;
  refreshFamilies: () => Promise<void>;
  loadFamilyDetail: (familyId: string) => Promise<void>;
  createFamily: (displayName: string) => Promise<FamilyActionResult>;
  clearDetail: () => void;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

function listErrorMessage(kind: FamilyListErrorKind): string | null {
  if (kind === "network") {
    return FAMILY_NETWORK_ERROR_MESSAGE;
  }
  if (kind === "malformed") {
    return FAMILY_MALFORMED_RESPONSE_MESSAGE;
  }
  if (kind === "server") {
    return FAMILY_SERVER_ERROR_MESSAGE;
  }
  return null;
}

function detailErrorMessage(
  status: FamilyDetailStatus,
  kind: FamilyListErrorKind,
): string | null {
  if (status === "unavailable") {
    return FAMILY_NOT_FOUND_MESSAGE;
  }
  return listErrorMessage(kind);
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  const principalId = session.principal?.id ?? null;
  const [state, setState] = useState<FamilyMemoryState>(
    createInitialFamilyMemoryState,
  );
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const createAbortRef = useRef<AbortController | null>(null);
  const clientRef = useRef<FamilyApiClient | null>(null);

  const getClient = (): FamilyApiClient => {
    if (!clientRef.current) {
      const authClient = getMobileAuthClient();
      clientRef.current = createFamilyApiClient({
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
    setState(clearFamilyMemoryState());
    await session.signOut();
  });

  useEffect(() => {
    setState((current) => bindFamilyPrincipal(current, principalId));
    if (principalId === null) {
      cancelAllRequests();
    }
  }, [principalId]);

  useEffect(() => {
    return () => {
      cancelAllRequests();
    };
  }, []);

  const loadFamiliesInternal = useEffectEvent(
    async (mode: "loading" | "refreshing") => {
      if (principalId === null || session.status !== "authenticated") {
        return;
      }

      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      let generation = 0;
      setState((current) => {
        const next = beginFamilyListLoad(current, mode);
        generation = next.listGeneration;
        return next;
      });

      const result = await getClient().listFamilies(controller.signal);

      setState((current) => {
        if (result.kind === "aborted") {
          return current;
        }

        if (result.kind === "unauthorized") {
          void handleUnauthorized();
          return clearFamilyMemoryState();
        }

        if (result.kind === "ok") {
          return applyFamilyListSuccess(current, {
            principalId: principalId!,
            generation,
            families: result.data,
          });
        }

        const listError: FamilyListErrorKind =
          result.kind === "network"
            ? "network"
            : result.kind === "malformed"
              ? "malformed"
              : "server";

        return applyFamilyListFailure(current, {
          principalId: principalId!,
          generation,
          error: listError,
        });
      });
    },
  );

  const value: FamilyContextValue = {
    families: state.families,
    listStatus: state.listStatus,
    listErrorMessage: listErrorMessage(state.listError),
    detail: state.detail,
    detailStatus: state.detailStatus,
    detailErrorMessage: detailErrorMessage(
      state.detailStatus,
      state.detailError,
    ),
    async loadFamilies() {
      await loadFamiliesInternal("loading");
    },
    async refreshFamilies() {
      await loadFamiliesInternal("refreshing");
    },
    async loadFamilyDetail(familyId: string) {
      if (principalId === null || session.status !== "authenticated") {
        return;
      }

      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      let generation = 0;
      setState((current) => {
        const next = beginFamilyDetailLoad(current, familyId);
        generation = next.detailGeneration;
        return next;
      });

      const result = await getClient().getFamily(familyId, controller.signal);

      setState((current) => {
        if (result.kind === "aborted") {
          return current;
        }

        if (result.kind === "unauthorized") {
          void handleUnauthorized();
          return clearFamilyMemoryState();
        }

        if (result.kind === "not_found") {
          return applyFamilyDetailUnavailable(current, {
            principalId: principalId!,
            generation,
            familyId,
          });
        }

        if (result.kind === "ok") {
          return applyFamilyDetailSuccess(current, {
            principalId: principalId!,
            generation,
            familyId,
            family: result.data,
            upsert: upsertFamilySorted,
          });
        }

        const detailError: FamilyListErrorKind =
          result.kind === "network"
            ? "network"
            : result.kind === "malformed"
              ? "malformed"
              : "server";

        if (
          current.principalId !== principalId ||
          current.detailGeneration !== generation ||
          current.detailFamilyId !== familyId
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
    async createFamily(displayName: string) {
      if (principalId === null || session.status !== "authenticated") {
        return { ok: false, message: FAMILY_SERVER_ERROR_MESSAGE };
      }

      createAbortRef.current?.abort();
      const controller = new AbortController();
      createAbortRef.current = controller;

      const result = await getClient().createFamily(
        { displayName },
        controller.signal,
      );

      if (result.kind === "aborted") {
        return { ok: false, message: FAMILY_NETWORK_ERROR_MESSAGE };
      }

      if (result.kind === "unauthorized") {
        await handleUnauthorized();
        return { ok: false, message: FAMILY_SERVER_ERROR_MESSAGE };
      }

      if (result.kind === "validation") {
        return {
          ok: false,
          message: messageForFamilyValidationCode(result.code),
          validationCode: result.code,
        };
      }

      if (result.kind !== "ok") {
        return {
          ok: false,
          message:
            result.kind === "network"
              ? FAMILY_NETWORK_ERROR_MESSAGE
              : result.kind === "malformed"
                ? FAMILY_MALFORMED_RESPONSE_MESSAGE
                : FAMILY_SERVER_ERROR_MESSAGE,
        };
      }

      // Refresh list from server after successful create (no optimistic insert).
      await loadFamiliesInternal("loading");

      if (
        session.status !== "authenticated" ||
        session.principal?.id !== principalId
      ) {
        return { ok: false, message: FAMILY_SERVER_ERROR_MESSAGE };
      }

      setState((current) => {
        if (current.principalId !== principalId) {
          return current;
        }

        return {
          ...current,
          families: upsertFamilySorted(current.families, result.data),
          detail: result.data,
          detailFamilyId: result.data.id,
          detailStatus: "ready",
          detailError: null,
        };
      });

      return { ok: true, family: result.data };
    },
    clearDetail() {
      detailAbortRef.current?.abort();
      setState((current) => ({
        ...current,
        detailFamilyId: null,
        detail: null,
        detailStatus: "idle",
        detailError: null,
      }));
    },
  };

  return (
    <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
  );
}

export function useFamilyStore(): FamilyContextValue {
  const value = useContext(FamilyContext);
  if (!value) {
    throw new Error("useFamilyStore must be used within FamilyProvider.");
  }
  return value;
}
