import {
  CHILD_DISPLAY_NAME_MAX_CODE_POINTS,
  type ChildValidationCode,
} from "./child.types";

export class ChildClientValidationError extends Error {
  constructor(readonly code: ChildValidationCode) {
    super("Invalid child displayName request.");
    this.name = "ChildClientValidationError";
  }
}

export type ValidatedChildDisplayNameInput = {
  displayName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Unicode code-point length (not UTF-16 code units). */
export function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

function parseDisplayNameInput(value: unknown): ValidatedChildDisplayNameInput {
  if (!isRecord(value)) {
    throw new ChildClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  const keys = Object.keys(value);
  if (keys.some((key) => key !== "displayName")) {
    throw new ChildClientValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "displayName")) {
    throw new ChildClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (typeof value.displayName !== "string") {
    throw new ChildClientValidationError("DISPLAY_NAME_INVALID");
  }

  const displayName = value.displayName.trim();

  if (displayName.length === 0) {
    throw new ChildClientValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (
    unicodeCodePointLength(displayName) > CHILD_DISPLAY_NAME_MAX_CODE_POINTS
  ) {
    throw new ChildClientValidationError("DISPLAY_NAME_TOO_LONG");
  }

  return { displayName };
}

/**
 * Client-side create validation mirroring server rules.
 * Server remains authoritative.
 */
export function parseCreateChildInput(
  value: unknown,
): ValidatedChildDisplayNameInput {
  return parseDisplayNameInput(value);
}

/**
 * Client-side displayName mutation validation mirroring server rules.
 * Server remains authoritative. Same-value updates are allowed.
 */
export function parseUpdateChildDisplayNameInput(
  value: unknown,
): ValidatedChildDisplayNameInput {
  return parseDisplayNameInput(value);
}
