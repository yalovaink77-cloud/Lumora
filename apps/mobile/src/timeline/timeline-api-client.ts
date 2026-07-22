import {
  TIMELINE_API_TIMEOUT_MS,
  type MobileChildTimelineEvent,
  type MobilePregnancyTimelineEvent,
  type TimelineApiResult,
  type TimelineValidationCode,
} from "./timeline.types";
import {
  mapChildTimelineEventResponse,
  mapChildTimelineListResponse,
  mapPregnancyTimelineEventResponse,
  mapPregnancyTimelineListResponse,
} from "./timeline-dto";
import {
  TimelineClientValidationError,
  parseCreateTimelineEventBody,
} from "./timeline-validation";

export type TimelineApiClientOptions = {
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

function mapValidationCode(code: unknown): TimelineValidationCode {
  if (
    code === "TITLE_REQUIRED" ||
    code === "TITLE_INVALID" ||
    code === "TITLE_TOO_LONG" ||
    code === "OCCURRED_AT_REQUIRED" ||
    code === "OCCURRED_AT_INVALID" ||
    code === "UNKNOWN_FIELD"
  ) {
    return code;
  }

  return "TITLE_INVALID";
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Smallest mobile Timeline API client (ADR-024).
 * Public methods remain subject-specific; cookie session only.
 */
export function createTimelineApiClient(options: TimelineApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMELINE_API_TIMEOUT_MS;
  const baseUrl = options.apiBaseUrl.replace(/\/$/, "");

  async function request(
    input: RequestOptions,
  ): Promise<TimelineApiResult<unknown>> {
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
        return { kind: "timeline_not_found" };
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
    async listPregnancyTimelineEvents(
      familyId: string,
      pregnancyId: string,
      signal?: AbortSignal,
    ): Promise<TimelineApiResult<MobilePregnancyTimelineEvent[]>> {
      if (familyId.trim().length === 0 || pregnancyId.trim().length === 0) {
        return { kind: "timeline_not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}/pregnancies/${encodeURIComponent(pregnancyId)}/timeline-events`,
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const events = mapPregnancyTimelineListResponse(
        result.data,
        familyId,
        pregnancyId,
      );
      if (!events) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: events };
    },

    async getPregnancyTimelineEvent(
      familyId: string,
      pregnancyId: string,
      timelineEventId: string,
      signal?: AbortSignal,
    ): Promise<TimelineApiResult<MobilePregnancyTimelineEvent>> {
      if (
        familyId.trim().length === 0 ||
        pregnancyId.trim().length === 0 ||
        timelineEventId.trim().length === 0
      ) {
        return { kind: "timeline_not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}/pregnancies/${encodeURIComponent(pregnancyId)}/timeline-events/${encodeURIComponent(timelineEventId)}`,
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const event = mapPregnancyTimelineEventResponse(
        result.data,
        familyId,
        pregnancyId,
      );
      if (!event) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: event };
    },

    async createPregnancyTimelineEvent(
      familyId: string,
      pregnancyId: string,
      input: unknown,
      signal?: AbortSignal,
    ): Promise<TimelineApiResult<MobilePregnancyTimelineEvent>> {
      if (familyId.trim().length === 0 || pregnancyId.trim().length === 0) {
        return { kind: "timeline_not_found" };
      }

      let body: { title: string; occurredAt: string };
      try {
        body = parseCreateTimelineEventBody(input);
      } catch (error: unknown) {
        if (error instanceof TimelineClientValidationError) {
          return { kind: "validation", code: error.code };
        }
        return { kind: "validation", code: "TITLE_INVALID" };
      }

      const result = await request({
        method: "POST",
        path: `/families/${encodeURIComponent(familyId)}/pregnancies/${encodeURIComponent(pregnancyId)}/timeline-events`,
        body,
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const event = mapPregnancyTimelineEventResponse(
        result.data,
        familyId,
        pregnancyId,
      );
      if (!event) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: event };
    },

    async listChildTimelineEvents(
      familyId: string,
      childId: string,
      signal?: AbortSignal,
    ): Promise<TimelineApiResult<MobileChildTimelineEvent[]>> {
      if (familyId.trim().length === 0 || childId.trim().length === 0) {
        return { kind: "timeline_not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}/children/${encodeURIComponent(childId)}/timeline-events`,
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const events = mapChildTimelineListResponse(
        result.data,
        familyId,
        childId,
      );
      if (!events) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: events };
    },

    async getChildTimelineEvent(
      familyId: string,
      childId: string,
      timelineEventId: string,
      signal?: AbortSignal,
    ): Promise<TimelineApiResult<MobileChildTimelineEvent>> {
      if (
        familyId.trim().length === 0 ||
        childId.trim().length === 0 ||
        timelineEventId.trim().length === 0
      ) {
        return { kind: "timeline_not_found" };
      }

      const result = await request({
        method: "GET",
        path: `/families/${encodeURIComponent(familyId)}/children/${encodeURIComponent(childId)}/timeline-events/${encodeURIComponent(timelineEventId)}`,
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const event = mapChildTimelineEventResponse(
        result.data,
        familyId,
        childId,
      );
      if (!event) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: event };
    },

    async createChildTimelineEvent(
      familyId: string,
      childId: string,
      input: unknown,
      signal?: AbortSignal,
    ): Promise<TimelineApiResult<MobileChildTimelineEvent>> {
      if (familyId.trim().length === 0 || childId.trim().length === 0) {
        return { kind: "timeline_not_found" };
      }

      let body: { title: string; occurredAt: string };
      try {
        body = parseCreateTimelineEventBody(input);
      } catch (error: unknown) {
        if (error instanceof TimelineClientValidationError) {
          return { kind: "validation", code: error.code };
        }
        return { kind: "validation", code: "TITLE_INVALID" };
      }

      const result = await request({
        method: "POST",
        path: `/families/${encodeURIComponent(familyId)}/children/${encodeURIComponent(childId)}/timeline-events`,
        body,
        ...(signal ? { signal } : {}),
      });

      if (result.kind !== "ok") {
        return result;
      }

      const event = mapChildTimelineEventResponse(
        result.data,
        familyId,
        childId,
      );
      if (!event) {
        return { kind: "malformed" };
      }

      return { kind: "ok", data: event };
    },
  };
}

export type TimelineApiClient = ReturnType<typeof createTimelineApiClient>;
