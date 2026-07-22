import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";

import {
  GENERIC_CONFIG_FAILURE_MESSAGE,
  GENERIC_NETWORK_FAILURE_MESSAGE,
  GENERIC_REGISTER_FAILURE_MESSAGE,
  GENERIC_SIGN_IN_FAILURE_MESSAGE,
  GENERIC_SIGN_OUT_FAILURE_MESSAGE,
} from "./auth-user-messages";
import { fetchNeutralPrincipal } from "./fetch-neutral-principal";
import {
  clearKnownMobileAuthStorage,
  getMobileApiBaseUrl,
  getMobileAuthClient,
} from "./mobile-auth-client";
import { InvalidApiBaseUrlError } from "../config/api-base-url";
import type { NeutralAuthenticatedPrincipal } from "./neutral-principal";
import {
  createInitialShellSessionState,
  toAuthenticatedState,
  toBootstrappingState,
  toErrorState,
  toUnauthenticatedState,
  type ShellErrorKind,
  type ShellSessionState,
} from "./session-shell-state";

export type AuthActionResult = { ok: true } | { ok: false; message: string };

export type AuthSessionContextValue = {
  status: ShellSessionState["status"];
  principal: NeutralAuthenticatedPrincipal | null;
  errorKind: ShellErrorKind | null;
  errorMessage: string | null;
  signIn: (input: {
    email: string;
    password: string;
  }) => Promise<AuthActionResult>;
  register: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  retryBootstrap: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function resolveConfigErrorMessage(): string {
  return GENERIC_CONFIG_FAILURE_MESSAGE;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [configError] = useState(() => {
    try {
      getMobileAuthClient();
      getMobileApiBaseUrl();
      return false;
    } catch (error) {
      return error instanceof InvalidApiBaseUrlError || error instanceof Error;
    }
  });

  if (configError) {
    return (
      <AuthSessionContext.Provider
        value={{
          status: "error",
          principal: null,
          errorKind: "config",
          errorMessage: resolveConfigErrorMessage(),
          signIn: async () => ({
            ok: false,
            message: resolveConfigErrorMessage(),
          }),
          register: async () => ({
            ok: false,
            message: resolveConfigErrorMessage(),
          }),
          signOut: async () => ({ ok: true }),
          retryBootstrap: () => undefined,
        }}
      >
        {children}
      </AuthSessionContext.Provider>
    );
  }

  return <AuthSessionProviderInner>{children}</AuthSessionProviderInner>;
}

function AuthSessionProviderInner({ children }: { children: ReactNode }) {
  const authClient = getMobileAuthClient();
  const apiBaseUrl = getMobileApiBaseUrl();
  const sessionQuery = authClient.useSession();
  const [shellState, setShellState] = useState<ShellSessionState>(
    createInitialShellSessionState,
  );
  const [bootstrapNonce, setBootstrapNonce] = useState(0);

  const confirmSession = useEffectEvent(async () => {
    if (sessionQuery.isPending) {
      setShellState(toBootstrappingState());
      return;
    }

    if (sessionQuery.error) {
      setShellState(toErrorState("network"));
      return;
    }

    if (!sessionQuery.data?.session) {
      setShellState(toUnauthenticatedState());
      return;
    }

    setShellState(toBootstrappingState());

    const result = await fetchNeutralPrincipal({
      apiBaseUrl,
      getCookie: () => authClient.getCookie(),
    });

    if (result.kind === "ok") {
      setShellState(toAuthenticatedState(result.principal));
      return;
    }

    if (result.kind === "unauthorized") {
      await authClient.signOut();
      await clearKnownMobileAuthStorage();
      setShellState(toUnauthenticatedState());
      return;
    }

    setShellState(toErrorState("network"));
  });

  useEffect(() => {
    void confirmSession();
  }, [
    sessionQuery.isPending,
    sessionQuery.error,
    sessionQuery.data?.session?.id,
    bootstrapNonce,
  ]);

  const value: AuthSessionContextValue = {
    status: shellState.status,
    principal: shellState.principal,
    errorKind: shellState.errorKind,
    errorMessage:
      shellState.errorKind === "config"
        ? GENERIC_CONFIG_FAILURE_MESSAGE
        : shellState.errorKind === "network"
          ? GENERIC_NETWORK_FAILURE_MESSAGE
          : null,
    async signIn({ email, password }) {
      try {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
        });

        if (result.error) {
          return { ok: false, message: GENERIC_SIGN_IN_FAILURE_MESSAGE };
        }

        setBootstrapNonce((value) => value + 1);
        return { ok: true };
      } catch {
        return { ok: false, message: GENERIC_NETWORK_FAILURE_MESSAGE };
      }
    },
    async register({ name, email, password }) {
      try {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });

        if (result.error) {
          return { ok: false, message: GENERIC_REGISTER_FAILURE_MESSAGE };
        }

        setBootstrapNonce((value) => value + 1);
        return { ok: true };
      } catch {
        return { ok: false, message: GENERIC_NETWORK_FAILURE_MESSAGE };
      }
    },
    async signOut() {
      try {
        await authClient.signOut();
        await clearKnownMobileAuthStorage();
        setShellState(toUnauthenticatedState());
        return { ok: true };
      } catch {
        return { ok: false, message: GENERIC_SIGN_OUT_FAILURE_MESSAGE };
      }
    },
    retryBootstrap() {
      setShellState(toBootstrappingState());
      setBootstrapNonce((value) => value + 1);
    },
  };

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }
  return value;
}
