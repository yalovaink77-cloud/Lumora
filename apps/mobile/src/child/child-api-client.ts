import {
  CHILD_API_TIMEOUT_MS,
  type ChildApiResult,
  type ChildValidationCode,
  type MobileChild,
} from "./child.types";
import { mapChildListResponse, mapChildResponse } from "./child-dto";
import {
  ChildClientValidationError,
  parseCreateChildInput,
  parseUpdateChildDisplayNameInput,
} from "./child-validation";

export type ChildApiClientOptions = {
  apiBaseUrl: string;
  getCookie: () => string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type RequestOptions = {
  method: "GET" | "POST" | "PATCH";
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  notFoundKind: "family_not_found" | "child_not_found";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapValidationCode(code: unknown): ChildValidationCode {
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
 * Smallest mobile Child API client (ADR-023).
 * Cookie session transport only; no custom bearer token auth.
 */
export function createChildApiClient(options: ChildApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? CHILD_API_TIMEOUT_MS;
  const baseUrl = options.apiBaseUrl.replace(/\/$/, "");

  async function request(
    input: RequestOptions,
  ): Promise<ChildApiResult<unknown>> {
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
    async listChildren(
      familyId: string,
      signal?: AbortSignal,
    ): Promise<ChildApiResult<MobileChild[]>> {
      if (familyId.trim().length === 0) {
        return { kind: "family_not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}/children`,
        notFoundKind: "family_not_found",
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const children = mapChildListResponse(result.data, familyId);
      if (!children) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: children };
    },

    async getChild(
      familyId: string,
      childId: string,
      signal?: AbortSignal,
    ): Promise<ChildApiResult<MobileChild>> {
      if (familyId.trim().length === 0) {
        return { kind: "family_not_found" };
      }
      if (childId.trim().length === 0) {
        return { kind: "child_not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}/children/${encodeURIComponent(childId)}`,
        notFoundKind: "child_not_found",
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const child = mapChildResponse(result.data, familyId);
      if (!child) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: child };
    },

    async createChild(
      familyId: string,
      input: unknown,
      signal?: AbortSignal,
    ): Promise<ChildApiResult<MobileChild>> {
      if (familyId.trim().length === 0) {
        return { kind: "family_not_found" };
      }

      let body: { displayName: string };
      try {
        body = parseCreateChildInput(input);
      } catch (error: unknown) {
        if (error instanceof ChildClientValidationError) {
          return { kind: "validation", code: error.code };
        }
        return { kind: "validation", code: "DISPLAY_NAME_INVALID" };
      }

      const result = await request({
        method: "POST",
        path: `/families/${encodeURIComponent(familyId)}/children`,
        body,
        notFoundKind: "family_not_found",
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const child = mapChildResponse(result.data, familyId);
      if (!child) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: child };
    },

    async updateChildDisplayName(
      familyId: string,
      childId: string,
      input: unknown,
      signal?: AbortSignal,
    ): Promise<ChildApiResult<MobileChild>> {
      if (familyId.trim().length === 0) {
        return { kind: "family_not_found" };
      }
      if (childId.trim().length === 0) {
        return { kind: "child_not_found" };
      }

      let body: { displayName: string };
      try {
        body = parseUpdateChildDisplayNameInput(input);
      } catch (error: unknown) {
        if (error instanceof ChildClientValidationError) {
          return { kind: "validation", code: error.code };
        }
        return { kind: "validation", code: "DISPLAY_NAME_INVALID" };
      }

      const result = await request({
        method: "PATCH",
        path: `/families/${encodeURIComponent(familyId)}/children/${encodeURIComponent(childId)}`,
        body,
        notFoundKind: "child_not_found",
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const child = mapChildResponse(result.data, familyId);
      if (!child) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: child };
    },
  };
}

export type ChildApiClient = ReturnType<typeof createChildApiClient>;
