import {
  FAMILY_DISPLAY_NAME_MAX_CODE_POINTS,
  type FamilyValidationCode,
} from "./family.types";

export class FamilyClientValidationError extends Error {
  constructor(readonly code: FamilyValidationCode) {
    super("Invalid family creation request.");
    this.name = "FamilyClientValidationError";
  }
}

export type ValidatedCreateFamilyInput = {
  displayName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Unicode code-point length (not UTF-16 code units). */
export function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * Client-side create validation mirroring server rules.
 * Server remains authoritative.
 */
export function parseCreateFamilyInput(
  value: unknown,
): ValidatedCreateFamilyInput {
  if (!isRecord(value)) {
    throw new FamilyClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  const keys = Object.keys(value);
  if (keys.some((key) => key !== "displayName")) {
    throw new FamilyClientValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "displayName")) {
    throw new FamilyClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (typeof value.displayName !== "string") {
    throw new FamilyClientValidationError("DISPLAY_NAME_INVALID");
  }

  const displayName = value.displayName.trim();

  if (displayName.length === 0) {
    throw new FamilyClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (
    unicodeCodePointLength(displayName) > FAMILY_DISPLAY_NAME_MAX_CODE_POINTS
  ) {
    throw new FamilyClientValidationError("DISPLAY_NAME_TOO_LONG");
  }

  return { displayName };
}
