import * as SecureStore from "expo-secure-store";

import { createMobileAuthClient } from "./create-mobile-auth-client";

/**
 * Default mobile auth client composition using Expo SecureStore.
 * Screens and session orchestration remain deferred to Sprint 2.9B.2.
 */
export function createDefaultMobileAuthClient() {
  const requireHttps =
    process.env.NODE_ENV === "production" ||
    process.env.EXPO_PUBLIC_LUMORA_REQUIRE_HTTPS === "true";

  return createMobileAuthClient({
    apiBaseUrl: process.env.EXPO_PUBLIC_LUMORA_API_BASE_URL ?? "",
    secureStore: SecureStore,
    requireHttps,
  });
}
