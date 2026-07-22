import {
  PREGNANCY_API_TIMEOUT_MS,
  type MobilePregnancy,
  type PregnancyApiResult,
  type PregnancyValidationCode,
} from "./pregnancy.types";
import {
  mapPregnancyListResponse,
  mapPregnancyResponse,
} from "./pregnancy-dto";
import {
  PregnancyClientValidationError,
  parseCreatePregnancyInput,
} from "./pregnancy-validation";

export type PregnancyApiClientOptions = {
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
  notFoundKind: "family_not_found" | "pregnancy_not_found";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapValidationCode(code: unknown): PregnancyValidationCode {
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
 * Smallest mobile Pregnancy API client (ADR-022).
 * Cookie session transport only; no custom bearer token auth.
 */
export function createPregnancyApiClient(options: PregnancyApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? PREGNANCY_API_TIMEOUT_MS;
  const baseUrl = options.apiBaseUrl.replace(/\/$/, "");

  async function request(
    input: RequestOptions,
  ): Promise<PregnancyApiResult<unknown>> {
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
        return { kind: input.notFoundKind };
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
    async listPregnancies(
      familyId: string,
      signal?: AbortSignal,
    ): Promise<PregnancyApiResult<MobilePregnancy[]>> {
      if (familyId.trim().length === 0) {
        return { kind: "family_not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}/pregnancies`,
        notFoundKind: "family_not_found",
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const pregnancies = mapPregnancyListResponse(result.data, familyId);
      if (!pregnancies) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: pregnancies };
    },

    async getPregnancy(
      familyId: string,
      pregnancyId: string,
      signal?: AbortSignal,
    ): Promise<PregnancyApiResult<MobilePregnancy>> {
      if (familyId.trim().length === 0) {
        return { kind: "family_not_found" };
      }
      if (pregnancyId.trim().length === 0) {
        return { kind: "pregnancy_not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}/pregnancies/${encodeURIComponent(pregnancyId)}`,
        notFoundKind: "pregnancy_not_found",
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const pregnancy = mapPregnancyResponse(result.data, familyId);
      if (!pregnancy) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: pregnancy };
    },

    async createPregnancy(
      familyId: string,
      input: unknown,
      signal?: AbortSignal,
    ): Promise<PregnancyApiResult<MobilePregnancy>> {
      if (familyId.trim().length === 0) {
        return { kind: "family_not_found" };
      }

      let body: { displayName: string };
      try {
        body = parseCreatePregnancyInput(input);
      } catch (error: unknown) {
        if (error instanceof PregnancyClientValidationError) {
          return { kind: "validation", code: error.code };
        }
        return { kind: "validation", code: "DISPLAY_NAME_INVALID" };
      }

      const result = await request({
        method: "POST",
        path: `/families/${encodeURIComponent(familyId)}/pregnancies`,
        body,
        notFoundKind: "family_not_found",
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const pregnancy = mapPregnancyResponse(result.data, familyId);
      if (!pregnancy) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: pregnancy };
    },
  };
}

export type PregnancyApiClient = ReturnType<typeof createPregnancyApiClient>;
