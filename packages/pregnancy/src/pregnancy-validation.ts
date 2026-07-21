import { z } from "zod";

export const PREGNANCY_DISPLAY_NAME_MAX_LENGTH = 100;

export type PregnancyValidationCode =
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_INVALID"
  | "DISPLAY_NAME_TOO_LONG"
  | "UNKNOWN_FIELD";

export class PregnancyValidationError extends Error {
  constructor(readonly code: PregnancyValidationCode) {
    super("Invalid pregnancy creation request.");
    this.name = "PregnancyValidationError";
  }
}

export type CreatePregnancyInput = {
  displayName: string;
};

const createPregnancyInputSchema = z.strictObject({
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
          (value) =>
            Array.from(value).length <= PREGNANCY_DISPLAY_NAME_MAX_LENGTH,
          {
            message: "DISPLAY_NAME_TOO_LONG",
          },
        ),
    ),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseCreatePregnancyInput(
  value: unknown,
): CreatePregnancyInput {
  if (!isRecord(value)) {
    throw new PregnancyValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (Object.keys(value).some((key) => key !== "displayName")) {
    throw new PregnancyValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "displayName")) {
    throw new PregnancyValidationError("DISPLAY_NAME_REQUIRED");
  }

  if (typeof value.displayName !== "string") {
    throw new PregnancyValidationError("DISPLAY_NAME_INVALID");
  }

  const result = createPregnancyInputSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const validationCode = result.error.issues[0]?.message;

  throw new PregnancyValidationError(
    validationCode === "DISPLAY_NAME_REQUIRED" ||
      validationCode === "DISPLAY_NAME_TOO_LONG"
      ? validationCode
      : "DISPLAY_NAME_INVALID",
  );
}
