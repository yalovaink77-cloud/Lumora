import {
  PREGNANCY_DISPLAY_NAME_MAX_CODE_POINTS,
  type PregnancyValidationCode,
} from "./pregnancy.types";

export class PregnancyClientValidationError extends Error {
  constructor(readonly code: PregnancyValidationCode) {
    super("Invalid pregnancy creation request.");
    this.name = "PregnancyClientValidationError";
  }
}

export type ValidatedCreatePregnancyInput = {
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
export function parseCreatePregnancyInput(
  value: unknown,
): ValidatedCreatePregnancyInput {
  if (!isRecord(value)) {
    throw new PregnancyClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  const keys = Object.keys(value);
  if (keys.some((key) => key !== "displayName")) {
    throw new PregnancyClientValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "displayName")) {
    throw new PregnancyClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (typeof value.displayName !== "string") {
    throw new PregnancyClientValidationError("DISPLAY_NAME_INVALID");
  }

  const displayName = value.displayName.trim();

  if (displayName.length === 0) {
    throw new PregnancyClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (
    unicodeCodePointLength(displayName) > PREGNANCY_DISPLAY_NAME_MAX_CODE_POINTS
  ) {
    throw new PregnancyClientValidationError("DISPLAY_NAME_TOO_LONG");
  }

  return { displayName };
}
