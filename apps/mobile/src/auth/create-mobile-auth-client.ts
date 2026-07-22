import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import {
  resolveMobileAuthTransportConfig,
  type SecureStoreLike,
} from "./mobile-auth-transport";

export type CreateMobileAuthClientOptions = {
  apiBaseUrl: string;
  secureStore: SecureStoreLike;
  requireHttps: boolean;
};

export type MobileAuthClient = ReturnType<typeof createMobileAuthClient>;

/**
 * Composes the Better Auth Expo client transport foundation.
 * Does not implement registration/sign-in UI or session orchestration screens.
 */
export function createMobileAuthClient(options: CreateMobileAuthClientOptions) {
  const transport = resolveMobileAuthTransportConfig({
    apiBaseUrl: options.apiBaseUrl,
    requireHttps: options.requireHttps,
  });

  return createAuthClient({
    baseURL: transport.baseURL,
    plugins: [
      expoClient({
        scheme: transport.scheme,
        storagePrefix: transport.storagePrefix,
        cookiePrefix: transport.cookiePrefix,
        storage: {
          getItem: options.secureStore.getItem,
          setItem: options.secureStore.setItem,
        },
      }),
    ],
  });
}
