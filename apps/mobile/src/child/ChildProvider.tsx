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
import { createChildApiClient, type ChildApiClient } from "./child-api-client";
import { upsertChildSorted } from "./child-dto";
import {
  CHILD_FAMILY_NOT_FOUND_MESSAGE,
  CHILD_MALFORMED_RESPONSE_MESSAGE,
  CHILD_NETWORK_ERROR_MESSAGE,
  CHILD_NOT_FOUND_MESSAGE,
  CHILD_SERVER_ERROR_MESSAGE,
  messageForChildValidationCode,
} from "./child-messages";
import {
  applyChildDetailSuccess,
  applyChildDetailUnavailable,
  applyChildDisplayNameUpdate,
  applyChildListFailure,
  applyChildListSuccess,
  applyChildListUnavailable,
  beginChildDetailLoad,
  beginChildListLoad,
  bindChildPrincipal,
  clearChildMemoryState,
  createInitialChildMemoryState,
  type ChildDetailStatus,
  type ChildListErrorKind,
  type ChildListStatus,
  type ChildMemoryState,
} from "./child-state";
import type { ChildValidationCode, MobileChild } from "./child.types";

export type ChildActionResult =
  | { ok: true; child?: MobileChild }
  | {
      ok: false;
      message: string;
      validationCode?: ChildValidationCode;
      familyUnavailable?: boolean;
      childUnavailable?: boolean;
    };

export type ChildContextValue = {
  familyId: string | null;
  children: MobileChild[];
  listStatus: ChildListStatus;
  listErrorMessage: string | null;
  detail: MobileChild | null;
  detailStatus: ChildDetailStatus;
  detailErrorMessage: string | null;
  loadChildren: (familyId: string) => Promise<void>;
  refreshChildren: (familyId: string) => Promise<void>;
  loadChildDetail: (familyId: string, childId: string) => Promise<void>;
  createChild: (
    familyId: string,
    displayName: string,
  ) => Promise<ChildActionResult>;
  updateChildDisplayName: (
    familyId: string,
    childId: string,
    displayName: string,
  ) => Promise<ChildActionResult>;
  clearDetail: () => void;
  clearFamilyContext: () => void;
};

const ChildContext = createContext<ChildContextValue | null>(null);

function listErrorMessage(
  status: ChildListStatus,
  kind: ChildListErrorKind,
): string | null {
  if (status === "unavailable") {
    return CHILD_FAMILY_NOT_FOUND_MESSAGE;
  }
  if (kind === "network") {
    return CHILD_NETWORK_ERROR_MESSAGE;
  }
  if (kind === "malformed") {
    return CHILD_MALFORMED_RESPONSE_MESSAGE;
  }
  if (kind === "server") {
    return CHILD_SERVER_ERROR_MESSAGE;
  }
  return null;
}

function detailErrorMessage(
  status: ChildDetailStatus,
  kind: ChildListErrorKind,
): string | null {
  if (status === "unavailable") {
    return CHILD_NOT_FOUND_MESSAGE;
  }
  return listErrorMessage("error", kind);
}

export function ChildProvider({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  const principalId = session.principal?.id ?? null;
  const [state, setState] = useState<ChildMemoryState>(
    createInitialChildMemoryState,
  );
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const createAbortRef = useRef<AbortController | null>(null);
  const updateAbortRef = useRef<AbortController | null>(null);
  const clientRef = useRef<ChildApiClient | null>(null);

  const getClient = (): ChildApiClient => {
    if (!clientRef.current) {
      const authClient = getMobileAuthClient();
      clientRef.current = createChildApiClient({
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
    updateAbortRef.current?.abort();
    listAbortRef.current = null;
    detailAbortRef.current = null;
    createAbortRef.current = null;
    updateAbortRef.current = null;
  });

  const handleUnauthorized = useEffectEvent(async () => {
    cancelAllRequests();
    setState(clearChildMemoryState());
    await session.signOut();
  });

  useEffect(() => {
    setState((current) => bindChildPrincipal(current, principalId));
    if (principalId === null) {
      cancelAllRequests();
    }
  }, [principalId]);

  useEffect(() => {
    return () => {
      cancelAllRequests();
    };
  }, []);

  const loadChildrenInternal = useEffectEvent(
    async (familyId: string, mode: "loading" | "refreshing") => {
      if (principalId === null || session.status !== "authenticated") {
        return;
      }

      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      let generation = 0;
      setState((current) => {
        const next = beginChildListLoad(current, familyId, mode);
        generation = next.listGeneration;
        return next;
      });

      const result = await getClient().listChildren(
        familyId,
        controller.signal,
      );

      setState((current) => {
        if (result.kind === "aborted") {
          return current;
        }

        if (result.kind === "unauthorized") {
          void handleUnauthorized();
          return clearChildMemoryState();
        }

        if (result.kind === "family_not_found") {
          return applyChildListUnavailable(current, {
            principalId: principalId!,
            familyId,
            generation,
          });
        }

        if (result.kind === "ok") {
          return applyChildListSuccess(current, {
            principalId: principalId!,
            familyId,
            generation,
            children: result.data,
          });
        }

        const listError: ChildListErrorKind =
          result.kind === "network"
            ? "network"
            : result.kind === "malformed"
              ? "malformed"
              : "server";

        return applyChildListFailure(current, {
          principalId: principalId!,
          familyId,
          generation,
          error: listError,
        });
      });
    },
  );

  const value: ChildContextValue = {
    familyId: state.familyId,
    children: state.children,
    listStatus: state.listStatus,
    listErrorMessage: listErrorMessage(state.listStatus, state.listError),
    detail: state.detail,
    detailStatus: state.detailStatus,
    detailErrorMessage: detailErrorMessage(
      state.detailStatus,
      state.detailError,
    ),
    async loadChildren(familyId: string) {
      await loadChildrenInternal(familyId, "loading");
    },
    async refreshChildren(familyId: string) {
      await loadChildrenInternal(familyId, "refreshing");
    },
    async loadChildDetail(familyId: string, childId: string) {
      if (principalId === null || session.status !== "authenticated") {
        return;
      }

      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      let generation = 0;
      setState((current) => {
        const next = beginChildDetailLoad(current, familyId, childId);
        generation = next.detailGeneration;
        return next;
      });

      const result = await getClient().getChild(
        familyId,
        childId,
        controller.signal,
      );

      setState((current) => {
        if (result.kind === "aborted") {
          return current;
        }

        if (result.kind === "unauthorized") {
          void handleUnauthorized();
          return clearChildMemoryState();
        }

        if (
          result.kind === "child_not_found" ||
          result.kind === "family_not_found"
        ) {
          return applyChildDetailUnavailable(current, {
            principalId: principalId!,
            familyId,
            generation,
            childId,
          });
        }

        if (result.kind === "ok") {
          return applyChildDetailSuccess(current, {
            principalId: principalId!,
            familyId,
            generation,
            childId,
            child: result.data,
            upsert: upsertChildSorted,
          });
        }

        const detailError: ChildListErrorKind =
          result.kind === "network"
            ? "network"
            : result.kind === "malformed"
              ? "malformed"
              : "server";

        if (
          current.principalId !== principalId ||
          current.familyId !== familyId ||
          current.detailGeneration !== generation ||
          current.detailChildId !== childId
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
    async createChild(familyId: string, displayName: string) {
      if (principalId === null || session.status !== "authenticated") {
        return { ok: false, message: CHILD_SERVER_ERROR_MESSAGE };
      }

      createAbortRef.current?.abort();
      const controller = new AbortController();
      createAbortRef.current = controller;

      const result = await getClient().createChild(
        familyId,
        { displayName },
        controller.signal,
      );

      if (result.kind === "aborted") {
        return { ok: false, message: CHILD_NETWORK_ERROR_MESSAGE };
      }

      if (result.kind === "unauthorized") {
        await handleUnauthorized();
        return { ok: false, message: CHILD_SERVER_ERROR_MESSAGE };
      }

      if (result.kind === "family_not_found") {
        return {
          ok: false,
          message: CHILD_FAMILY_NOT_FOUND_MESSAGE,
          familyUnavailable: true,
        };
      }

      if (result.kind === "validation") {
        return {
          ok: false,
          message: messageForChildValidationCode(result.code),
          validationCode: result.code,
        };
      }

      if (result.kind !== "ok") {
        return {
          ok: false,
          message:
            result.kind === "network"
              ? CHILD_NETWORK_ERROR_MESSAGE
              : result.kind === "malformed"
                ? CHILD_MALFORMED_RESPONSE_MESSAGE
                : CHILD_SERVER_ERROR_MESSAGE,
        };
      }

      await loadChildrenInternal(familyId, "loading");

      if (
        session.status !== "authenticated" ||
        session.principal?.id !== principalId
      ) {
        return { ok: false, message: CHILD_SERVER_ERROR_MESSAGE };
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
          children: upsertChildSorted(current.children, result.data),
          detail: result.data,
          detailChildId: result.data.id,
          detailStatus: "ready",
          detailError: null,
        };
      });

      return { ok: true, child: result.data };
    },
    async updateChildDisplayName(
      familyId: string,
      childId: string,
      displayName: string,
    ) {
      if (principalId === null || session.status !== "authenticated") {
        return { ok: false, message: CHILD_SERVER_ERROR_MESSAGE };
      }

      updateAbortRef.current?.abort();
      const controller = new AbortController();
      updateAbortRef.current = controller;

      const result = await getClient().updateChildDisplayName(
        familyId,
        childId,
        { displayName },
        controller.signal,
      );

      if (result.kind === "aborted") {
        return { ok: false, message: CHILD_NETWORK_ERROR_MESSAGE };
      }

      if (result.kind === "unauthorized") {
        await handleUnauthorized();
        return { ok: false, message: CHILD_SERVER_ERROR_MESSAGE };
      }

      if (result.kind === "child_not_found") {
        setState((current) => {
          if (
            current.principalId !== principalId ||
            current.familyId !== familyId
          ) {
            return current;
          }

          if (
            current.detailChildId === childId ||
            current.detail?.id === childId
          ) {
            return {
              ...current,
              detail: null,
              detailStatus: "unavailable",
              detailError: null,
            };
          }

          return current;
        });

        return {
          ok: false,
          message: CHILD_NOT_FOUND_MESSAGE,
          childUnavailable: true,
        };
      }

      if (result.kind === "validation") {
        return {
          ok: false,
          message: messageForChildValidationCode(result.code),
          validationCode: result.code,
        };
      }

      if (result.kind !== "ok") {
        return {
          ok: false,
          message:
            result.kind === "network"
              ? CHILD_NETWORK_ERROR_MESSAGE
              : result.kind === "malformed"
                ? CHILD_MALFORMED_RESPONSE_MESSAGE
                : CHILD_SERVER_ERROR_MESSAGE,
        };
      }

      if (
        session.status !== "authenticated" ||
        session.principal?.id !== principalId
      ) {
        return { ok: false, message: CHILD_SERVER_ERROR_MESSAGE };
      }

      let applied = false;
      setState((current) => {
        if (
          current.principalId !== principalId ||
          current.familyId !== familyId
        ) {
          return current;
        }

        applied = true;
        return applyChildDisplayNameUpdate(current, {
          principalId,
          familyId,
          childId,
          child: result.data,
          upsert: upsertChildSorted,
        });
      });

      if (!applied) {
        return { ok: false, message: CHILD_SERVER_ERROR_MESSAGE };
      }

      return { ok: true, child: result.data };
    },
    clearDetail() {
      detailAbortRef.current?.abort();
      setState((current) => ({
        ...current,
        detailChildId: null,
        detail: null,
        detailStatus: "idle",
        detailError: null,
      }));
    },
    clearFamilyContext() {
      cancelAllRequests();
      setState((current) => ({
        ...createInitialChildMemoryState(),
        principalId: current.principalId,
      }));
    },
  };

  return (
    <ChildContext.Provider value={value}>{children}</ChildContext.Provider>
  );
}

export function useChildStore(): ChildContextValue {
  const value = useContext(ChildContext);
  if (!value) {
    throw new Error("useChildStore must be used within ChildProvider.");
  }
  return value;
}
