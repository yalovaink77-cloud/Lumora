import type { VerificationEmailDeliveryPort } from "./verification-delivery.js";

export type AuthEmailVerificationDeliveryConfig = Readonly<{
  mode: "capture";
  confirmationPageUrl: string;
  adapter: VerificationEmailDeliveryPort;
}>;

export type AuthRuntimeConfig = {
  secret: string;
  baseUrl: string;
  trustedOrigins: string[];
  secureCookies: boolean;
  delivery: AuthEmailVerificationDeliveryConfig;
};

export type ParseTrustedOriginsOptions = {
  allowExpoDevelopmentOrigins?: boolean;
};

const PLACEHOLDER_SECRETS = new Set([
  "change-me",
  "changeme",
  "your-secret-here",
  "replace-me",
  "test-secret",
  "development-secret",
]);

/** Production mobile application scheme origins approved by ADR-020. */
const APPROVED_MOBILE_APP_SCHEME_ORIGINS = new Set(["lumora://", "lumora://*"]);

/**
 * Development-only Expo Go origins approved by ADR-020 / Better Auth Expo guide.
 * These must never be accepted when NODE_ENV is production.
 */
const APPROVED_EXPO_DEVELOPMENT_ORIGINS = new Set(["exp://", "exp://**"]);

function assertNoCredentialsQueryOrFragment(origin: string, parsed: URL): void {
  if (
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new Error(
      `AUTH_TRUSTED_ORIGINS origin must not include credentials, query, or fragment: ${origin}`,
    );
  }
}

export function parseTrustedOrigins(
  rawValue: string | undefined,
  options: ParseTrustedOriginsOptions = {},
): string[] {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    throw new Error("AUTH_TRUSTED_ORIGINS is required but was not provided.");
  }

  const origins = rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error("AUTH_TRUSTED_ORIGINS must include at least one origin.");
  }

  for (const origin of origins) {
    if (origin === "*") {
      throw new Error(
        "AUTH_TRUSTED_ORIGINS must not include wildcard origins.",
      );
    }

    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        `AUTH_TRUSTED_ORIGINS contains an invalid origin: ${origin}`,
      );
    }

    assertNoCredentialsQueryOrFragment(origin, parsed);

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      continue;
    }

    if (parsed.protocol === "lumora:") {
      if (!APPROVED_MOBILE_APP_SCHEME_ORIGINS.has(origin)) {
        throw new Error(
          `AUTH_TRUSTED_ORIGINS mobile scheme must be exactly lumora:// or lumora://*: ${origin}`,
        );
      }

      continue;
    }

    if (parsed.protocol === "exp:") {
      if (!options.allowExpoDevelopmentOrigins) {
        throw new Error(
          "AUTH_TRUSTED_ORIGINS Expo development origins are not allowed in production.",
        );
      }

      if (!APPROVED_EXPO_DEVELOPMENT_ORIGINS.has(origin)) {
        throw new Error(
          `AUTH_TRUSTED_ORIGINS Expo development origin is not approved: ${origin}`,
        );
      }

      continue;
    }

    throw new Error(
      `AUTH_TRUSTED_ORIGINS origin uses an unapproved scheme: ${origin}`,
    );
  }

  return origins;
}

export function validateAuthRuntimeConfig(
  env: NodeJS.ProcessEnv,
  options?: {
    allowPlaceholderSecret?: boolean;
    captureAdapter?: VerificationEmailDeliveryPort;
  },
): AuthRuntimeConfig {
  const secret = env.BETTER_AUTH_SECRET;

  if (typeof secret !== "string" || secret.trim().length === 0) {
    throw new Error("BETTER_AUTH_SECRET is required but was not provided.");
  }

  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");
  }

  if (
    !options?.allowPlaceholderSecret &&
    PLACEHOLDER_SECRETS.has(secret.trim().toLowerCase())
  ) {
    throw new Error("BETTER_AUTH_SECRET must not use a placeholder value.");
  }

  const baseUrlValue = env.BETTER_AUTH_URL;

  if (typeof baseUrlValue !== "string" || baseUrlValue.trim().length === 0) {
    throw new Error("BETTER_AUTH_URL is required but was not provided.");
  }

  let baseUrl: URL;

  try {
    baseUrl = new URL(baseUrlValue);
  } catch {
    throw new Error("BETTER_AUTH_URL must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("BETTER_AUTH_URL must use http or https.");
  }

  const nodeEnv = env.NODE_ENV ?? "development";
  const allowExpoDevelopmentOrigins = ["development", "test"].includes(nodeEnv);
  const trustedOrigins = parseTrustedOrigins(env.AUTH_TRUSTED_ORIGINS, {
    allowExpoDevelopmentOrigins,
  });
  const secureCookies = nodeEnv === "production";
  const deliveryMode = env.AUTH_EMAIL_VERIFICATION_DELIVERY_MODE;
  const confirmationPageUrlValue =
    env.AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL;

  if (typeof deliveryMode !== "string" || deliveryMode.length === 0) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_DELIVERY_MODE is required but was not provided.",
    );
  }

  if (!["capture", "production"].includes(deliveryMode)) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_DELIVERY_MODE must select a supported adapter.",
    );
  }

  if (
    deliveryMode === "capture" &&
    !["test", "development"].includes(nodeEnv)
  ) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_DELIVERY_MODE capture is allowed only in test or development.",
    );
  }

  if (deliveryMode === "capture" && !options?.captureAdapter) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_DELIVERY_MODE capture requires an explicitly injected adapter.",
    );
  }

  if (
    typeof confirmationPageUrlValue !== "string" ||
    confirmationPageUrlValue.length === 0
  ) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL is required but was not provided.",
    );
  }

  let confirmationPageUrl: URL;

  try {
    confirmationPageUrl = new URL(confirmationPageUrlValue);
  } catch {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL must be a valid absolute URL.",
    );
  }

  if (!["http:", "https:"].includes(confirmationPageUrl.protocol)) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL must use http or https.",
    );
  }

  if (confirmationPageUrl.search || confirmationPageUrl.hash) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL must not include a query or fragment.",
    );
  }

  const confirmationHostIsLoopback = ["localhost", "127.0.0.1", "::1"].includes(
    confirmationPageUrl.hostname,
  );

  if (
    !secureCookies &&
    confirmationPageUrl.protocol !== "https:" &&
    !confirmationHostIsLoopback
  ) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL must use https outside local environments.",
    );
  }

  if (secureCookies) {
    const hasLocalhostOrigin = trustedOrigins.some((origin) => {
      const parsed = new URL(origin);
      return (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
      );
    });

    if (hasLocalhostOrigin) {
      throw new Error(
        "AUTH_TRUSTED_ORIGINS must not include localhost origins in production.",
      );
    }

    if (baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1") {
      throw new Error("BETTER_AUTH_URL must not use localhost in production.");
    }

    if (confirmationPageUrl.protocol !== "https:") {
      throw new Error(
        "AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL must use https in production.",
      );
    }
  }

  const confirmationOriginIsTrusted = trustedOrigins.some((origin) => {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === confirmationPageUrl.origin
    );
  });

  if (!confirmationOriginIsTrusted) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL must use a trusted origin.",
    );
  }

  if (deliveryMode === "production") {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_DELIVERY_MODE production has no configured production-capable adapter.",
    );
  }

  if (!options?.captureAdapter) {
    throw new Error(
      "AUTH_EMAIL_VERIFICATION_DELIVERY_MODE capture requires an explicitly injected adapter.",
    );
  }

  return {
    secret,
    baseUrl: baseUrl.toString().replace(/\/$/, ""),
    trustedOrigins,
    secureCookies,
    delivery: {
      mode: "capture",
      confirmationPageUrl: confirmationPageUrl.toString().replace(/\/$/, ""),
      adapter: options.captureAdapter,
    },
  };
}
