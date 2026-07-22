/** Mobile DTO for Pregnancy Timeline events. */
export type MobilePregnancyTimelineEvent = {
  id: string;
  familyId: string;
  pregnancyId: string;
  title: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

/** Mobile DTO for Child Timeline events. */
export type MobileChildTimelineEvent = {
  id: string;
  familyId: string;
  childId: string;
  title: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type MobileTimelineEvent =
  MobilePregnancyTimelineEvent | MobileChildTimelineEvent;

export type TimelineSubjectType = "pregnancy" | "child";

export type TimelineValidationCode =
  | "TITLE_REQUIRED"
  | "TITLE_INVALID"
  | "TITLE_TOO_LONG"
  | "OCCURRED_AT_REQUIRED"
  | "OCCURRED_AT_INVALID"
  | "UNKNOWN_FIELD"
  | "OCCURRED_AT_UNCONFIRMED";

export type TimelineApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized" }
  | { kind: "timeline_not_found" }
  | { kind: "validation"; code: TimelineValidationCode }
  | { kind: "network" }
  | { kind: "server" }
  | { kind: "aborted" }
  | { kind: "malformed" };

/** ADR-024 default bounded timeout. */
export const TIMELINE_API_TIMEOUT_MS = 15_000;

export const TIMELINE_TITLE_MAX_CODE_POINTS = 80;
