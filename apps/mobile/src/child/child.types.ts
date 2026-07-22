/** Mobile DTO for Child list/detail (matches API ChildResponse). */
export type MobileChild = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type ChildValidationCode =
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_INVALID"
  | "DISPLAY_NAME_TOO_LONG"
  | "UNKNOWN_FIELD";

export type ChildApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized" }
  | { kind: "family_not_found" }
  | { kind: "child_not_found" }
  | { kind: "validation"; code: ChildValidationCode }
  | { kind: "network" }
  | { kind: "server" }
  | { kind: "aborted" }
  | { kind: "malformed" };

/** ADR-023 default bounded timeout. */
export const CHILD_API_TIMEOUT_MS = 15_000;

export const CHILD_DISPLAY_NAME_MAX_CODE_POINTS = 80;
