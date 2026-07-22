/** Mobile DTO for Family list/detail (matches API FamilyResponse). */
export type MobileFamily = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type FamilyValidationCode =
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_INVALID"
  | "DISPLAY_NAME_TOO_LONG"
  | "UNKNOWN_FIELD";

export type FamilyApiFailureKind =
  | "unauthorized"
  | "not_found"
  | "validation"
  | "network"
  | "server"
  | "aborted"
  | "malformed";

export type FamilyApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "validation"; code: FamilyValidationCode }
  | { kind: "network" }
  | { kind: "server" }
  | { kind: "aborted" }
  | { kind: "malformed" };

/** ADR-021 default bounded timeout. */
export const FAMILY_API_TIMEOUT_MS = 15_000;

export const FAMILY_DISPLAY_NAME_MAX_CODE_POINTS = 100;
