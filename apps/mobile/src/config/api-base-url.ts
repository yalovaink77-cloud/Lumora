export type ApiBaseUrlValidationOptions = {
  /**
   * When true, non-HTTPS URLs are rejected even for loopback hosts.
   * Release/production mobile builds must set this to true.
   */
  requireHttps: boolean;
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "10.0.2.2"]);

export class InvalidApiBaseUrlError extends Error {
  readonly code = "INVALID_API_BASE_URL";

  constructor() {
    super("Mobile API base URL configuration is invalid.");
    this.name = "InvalidApiBaseUrlError";
  }
}

function isApprovedLocalHttpHost(hostname: string): boolean {
  if (LOOPBACK_HOSTS.has(hostname)) {
    return true;
  }

  // Private LAN ranges used by physical devices during local development.
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
  if (match) {
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
  }

  return false;
}

/**
 * Validates EXPO_PUBLIC_LUMORA_API_BASE_URL.
 *
 * Returns the origin only (scheme + host + optional port), with no trailing
 * path, query, fragment, or credentials.
 */
export function parseApiBaseUrl(
  rawValue: string | undefined,
  options: ApiBaseUrlValidationOptions,
): string {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    throw new InvalidApiBaseUrlError();
  }

  // Reject ambiguous trailing paths before URL normalization collapses them.
  if (rawValue.includes("?") || rawValue.includes("#")) {
    throw new InvalidApiBaseUrlError();
  }

  let parsed: URL;

  try {
    parsed = new URL(rawValue);
  } catch {
    throw new InvalidApiBaseUrlError();
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new InvalidApiBaseUrlError();
  }

  if (parsed.search.length > 0 || parsed.hash.length > 0) {
    throw new InvalidApiBaseUrlError();
  }

  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new InvalidApiBaseUrlError();
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidApiBaseUrlError();
  }

  if (options.requireHttps && parsed.protocol !== "https:") {
    throw new InvalidApiBaseUrlError();
  }

  if (
    parsed.protocol === "http:" &&
    !isApprovedLocalHttpHost(parsed.hostname)
  ) {
    throw new InvalidApiBaseUrlError();
  }

  return parsed.origin;
}

export function resolveApiBaseUrlFromEnv(
  env: Record<string, string | undefined>,
  options?: Partial<ApiBaseUrlValidationOptions>,
): string {
  const requireHttps =
    options?.requireHttps ??
    (env.NODE_ENV === "production" ||
      env.EXPO_PUBLIC_LUMORA_REQUIRE_HTTPS === "true");

  return parseApiBaseUrl(env.EXPO_PUBLIC_LUMORA_API_BASE_URL, {
    requireHttps,
  });
}
