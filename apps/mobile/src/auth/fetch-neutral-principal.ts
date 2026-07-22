import {
  toNeutralPrincipal,
  type NeutralAuthenticatedPrincipal,
} from "./neutral-principal";

export type FetchNeutralPrincipalResult =
  | { kind: "ok"; principal: NeutralAuthenticatedPrincipal }
  | { kind: "unauthorized" }
  | { kind: "error" };

export type FetchNeutralPrincipalOptions = {
  apiBaseUrl: string;
  getCookie: () => string;
  fetchImpl?: typeof fetch;
};

/**
 * Maps GET /auth/me JSON to the approved neutral principal.
 * Unexpected Family role/permission fields are ignored and never stored.
 */
export function mapAuthMeResponse(
  body: unknown,
): NeutralAuthenticatedPrincipal | null {
  if (body === null || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.email !== "string" ||
    typeof record.emailVerified !== "boolean" ||
    typeof record.name !== "string"
  ) {
    return null;
  }

  return toNeutralPrincipal({
    id: record.id,
    email: record.email,
    emailVerified: record.emailVerified,
    name: record.name,
  });
}

/**
 * Confirms a cookie-backed session against Lumora GET /auth/me.
 * Uses the Expo plugin cookie header and omits credential mode conflicts.
 */
export async function fetchNeutralPrincipal(
  options: FetchNeutralPrincipalOptions,
): Promise<FetchNeutralPrincipalResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cookie = options.getCookie();

  try {
    const response = await fetchImpl(`${options.apiBaseUrl}/auth/me`, {
      method: "GET",
      headers: cookie.length > 0 ? { Cookie: cookie } : {},
      credentials: "omit",
    });

    if (response.status === 401) {
      return { kind: "unauthorized" };
    }

    if (!response.ok) {
      return { kind: "error" };
    }

    const body: unknown = await response.json();
    const principal = mapAuthMeResponse(body);
    if (!principal) {
      return { kind: "error" };
    }

    return { kind: "ok", principal };
  } catch {
    return { kind: "error" };
  }
}
