import { z } from "zod";

export const FAMILY_DISPLAY_NAME_MAX_LENGTH = 100;

export type FamilyValidationCode =
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_INVALID"
  | "DISPLAY_NAME_TOO_LONG"
  | "UNKNOWN_FIELD";

export class FamilyValidationError extends Error {
  constructor(readonly code: FamilyValidationCode) {
    super("Invalid family creation request.");
    this.name = "FamilyValidationError";
  }
}

export type CreateFamilyInput = {
  displayName: string;
};

const createFamilyInputSchema = z.strictObject({
  displayName: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, {
          message: "DISPLAY_NAME_REQUIRED",
        })
        .refine(
          (value) => Array.from(value).length <= FAMILY_DISPLAY_NAME_MAX_LENGTH,
          {
            message: "DISPLAY_NAME_TOO_LONG",
          },
        ),
    ),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseCreateFamilyInput(value: unknown): CreateFamilyInput {
  if (!isRecord(value)) {
    throw new FamilyValidationError("DISPLAY_NAME_REQUIRED");
  }

  const keys = Object.keys(value);
  const unknownField = keys.some((key) => key !== "displayName");

  if (unknownField) {
    throw new FamilyValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "displayName")) {
    throw new FamilyValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (typeof value.displayName !== "string") {
    throw new FamilyValidationError("DISPLAY_NAME_INVALID");
  }

  const result = createFamilyInputSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const validationCode = result.error.issues[0]?.message;

  throw new FamilyValidationError(
    validationCode === "DISPLAY_NAME_REQUIRED" ||
      validationCode === "DISPLAY_NAME_TOO_LONG"
      ? validationCode
      : "DISPLAY_NAME_INVALID",
  );
}
