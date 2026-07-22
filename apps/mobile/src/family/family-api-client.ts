import {
  FAMILY_API_TIMEOUT_MS,
  type FamilyApiResult,
  type FamilyValidationCode,
  type MobileFamily,
} from "./family.types";
import {
  mapCreatedFamilyResponse,
  mapFamilyListResponse,
  mapFamilyResponse,
} from "./family-dto";
import {
  FamilyClientValidationError,
  parseCreateFamilyInput,
} from "./family-validation";

export type FamilyApiClientOptions = {
  apiBaseUrl: string;
  getCookie: () => string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type RequestOptions = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  signal?: AbortSignal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapValidationCode(code: unknown): FamilyValidationCode {
  if (
    code === "DISPLAY_NAME_REQUIRED" ||
    code === "DISPLAY_NAME_INVALID" ||
    code === "DISPLAY_NAME_TOO_LONG" ||
    code === "UNKNOWN_FIELD"
  ) {
    return code;
  }

  return "DISPLAY_NAME_INVALID";
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Smallest mobile Family API client (ADR-021).
 * Cookie session transport only; no custom bearer token auth.
 */
export function createFamilyApiClient(options: FamilyApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? FAMILY_API_TIMEOUT_MS;
  const baseUrl = options.apiBaseUrl.replace(/\/$/, "");

  async function request(
    input: RequestOptions,
  ): Promise<FamilyApiResult<unknown>> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const cookie = options.getCookie();
    if (cookie.length > 0) {
      headers.Cookie = cookie;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => {
      controller.abort();
    };
    input.signal?.addEventListener("abort", onExternalAbort);

    try {
      const init: RequestInit = {
        method: input.method,
        headers,
        credentials: "omit",
        signal: controller.signal,
      };
      if (input.body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(input.body);
      }

      const response = await fetchImpl(`${baseUrl}${input.path}`, init);

      if (response.status === 401) {
        return { kind: "unauthorized" };
      }

      if (response.status === 404) {
        const payload = await parseJsonSafe(response);
        if (
          isRecord(payload) &&
          (payload.code === "FAMILY_NOT_FOUND" ||
            payload.message === "Family not found.")
        ) {
          return { kind: "not_found" };
        }
        return { kind: "not_found" };
      }

      if (response.status === 400) {
        const payload = await parseJsonSafe(response);
        const code = isRecord(payload) ? payload.code : undefined;
        return { kind: "validation", code: mapValidationCode(code) };
      }

      if (!response.ok) {
        return { kind: "server" };
      }

      const payload = await parseJsonSafe(response);
      return { kind: "ok", data: payload };
    } catch (error: unknown) {
      if (
        (error instanceof Error && error.name === "AbortError") ||
        input.signal?.aborted ||
        controller.signal.aborted
      ) {
        return { kind: "aborted" };
      }

      return { kind: "network" };
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  return {
    async listFamilies(
      signal?: AbortSignal,
    ): Promise<FamilyApiResult<MobileFamily[]>> {
      const result = await request({
        method: "GET",
        path: "/families",
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const families = mapFamilyListResponse(result.data);
      if (!families) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: families };
    },

    async getFamily(
      familyId: string,
      signal?: AbortSignal,
    ): Promise<FamilyApiResult<MobileFamily>> {
      if (familyId.trim().length === 0) {
        return { kind: "not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}`,
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const family = mapFamilyResponse(result.data);
      if (!family) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: family };
    },

    async createFamily(
      input: unknown,
      signal?: AbortSignal,
    ): Promise<FamilyApiResult<MobileFamily>> {
      let body: { displayName: string };
      try {
        body = parseCreateFamilyInput(input);
      } catch (error: unknown) {
        if (error instanceof FamilyClientValidationError) {
          return { kind: "validation", code: error.code };
        }
        return { kind: "validation", code: "DISPLAY_NAME_INVALID" };
      }

      const result = await request({
        method: "POST",
        path: "/families",
        body,
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const family = mapCreatedFamilyResponse(result.data);
      if (!family) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: family };
    },
  };
}

export type FamilyApiClient = ReturnType<typeof createFamilyApiClient>;
