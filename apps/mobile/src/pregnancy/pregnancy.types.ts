/** Mobile DTO for Pregnancy list/detail (matches API PregnancyResponse). */
export type MobilePregnancy = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type PregnancyValidationCode =
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_INVALID"
  | "DISPLAY_NAME_TOO_LONG"
  | "UNKNOWN_FIELD";

export type PregnancyApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized" }
  | { kind: "family_not_found" }
  | { kind: "pregnancy_not_found" }
  | { kind: "validation"; code: PregnancyValidationCode }
  | { kind: "network" }
  | { kind: "server" }
  | { kind: "aborted" }
  | { kind: "malformed" };

/** ADR-022 default bounded timeout. */
export const PREGNANCY_API_TIMEOUT_MS = 15_000;

export const PREGNANCY_DISPLAY_NAME_MAX_CODE_POINTS = 100;
