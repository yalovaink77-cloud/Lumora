import * as SecureStore from "expo-secure-store";

import {
  createMobileAuthClient,
  type MobileAuthClient,
} from "./create-mobile-auth-client";
import {
  clearMobileAuthSecureStore,
  LUMORA_AUTH_STORAGE_PREFIX,
} from "./mobile-auth-transport";
import { resolveApiBaseUrlFromEnv } from "../config/api-base-url";

let singleton: MobileAuthClient | null = null;

/**
 * Resolves whether production HTTPS must be required for the API base URL.
 */
export function resolveMobileRequireHttps(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.NODE_ENV === "production" ||
    env.EXPO_PUBLIC_LUMORA_REQUIRE_HTTPS === "true"
  );
}

/**
 * Default mobile auth client singleton using Expo SecureStore.
 */
export function getMobileAuthClient(): MobileAuthClient {
  if (singleton) {
    return singleton;
  }

  const requireHttps = resolveMobileRequireHttps();
  const apiBaseUrl = resolveApiBaseUrlFromEnv(process.env, { requireHttps });

  singleton = createMobileAuthClient({
    apiBaseUrl,
    secureStore: SecureStore,
    requireHttps,
  });

  return singleton;
}

/** Test-only helper to reset the singleton between cases. */
export function resetMobileAuthClientForTests(): void {
  singleton = null;
}

/**
 * Clears known Lumora-prefixed SecureStore auth material after sign-out.
 * The Expo plugin owns exact key names; these cover the documented cookie cache.
 */
export async function clearKnownMobileAuthStorage(): Promise<void> {
  const keys = [
    `${LUMORA_AUTH_STORAGE_PREFIX}_cookie`,
    `${LUMORA_AUTH_STORAGE_PREFIX}_session_data`,
  ];

  await clearMobileAuthSecureStore(SecureStore, keys);
}

export function getMobileApiBaseUrl(): string {
  return resolveApiBaseUrlFromEnv(process.env, {
    requireHttps: resolveMobileRequireHttps(),
  });
}
