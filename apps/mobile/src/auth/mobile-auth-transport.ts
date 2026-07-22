import { parseApiBaseUrl } from "../config/api-base-url";

/** Lumora namespace prefix for Better Auth Expo SecureStore keys. */
export const LUMORA_AUTH_STORAGE_PREFIX = "lumora";

/** Approved mobile application scheme from ADR-020. */
export const LUMORA_APP_SCHEME = "lumora";

export type MobileAuthTransportConfig = {
  baseURL: string;
  scheme: typeof LUMORA_APP_SCHEME;
  storagePrefix: typeof LUMORA_AUTH_STORAGE_PREFIX;
  cookiePrefix: "better-auth";
};

export type ResolveMobileAuthTransportOptions = {
  apiBaseUrl: string;
  requireHttps: boolean;
};

/**
 * Pure transport configuration for the Better Auth Expo client.
 * Safe to unit-test in Node without loading React Native.
 */
export function resolveMobileAuthTransportConfig(
  options: ResolveMobileAuthTransportOptions,
): MobileAuthTransportConfig {
  return {
    baseURL: parseApiBaseUrl(options.apiBaseUrl, {
      requireHttps: options.requireHttps,
    }),
    scheme: LUMORA_APP_SCHEME,
    storagePrefix: LUMORA_AUTH_STORAGE_PREFIX,
    cookiePrefix: "better-auth",
  };
}

export type SecureStoreLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => unknown;
  deleteItemAsync?: (key: string) => Promise<void>;
};

/**
 * Clears Better Auth Expo SecureStore material for future sign-out composition.
 * Key enumeration is owned by the Expo plugin; callers should also invoke the
 * Better Auth signOut API when the authenticated shell is implemented.
 */
export async function clearMobileAuthSecureStore(
  secureStore: SecureStoreLike,
  keys: readonly string[],
): Promise<void> {
  if (!secureStore.deleteItemAsync) {
    throw new Error(
      "SecureStore deleteItemAsync is required for auth cleanup composition.",
    );
  }

  await Promise.all(keys.map((key) => secureStore.deleteItemAsync!(key)));
}
