import { z } from "zod";

export const CHILD_DISPLAY_NAME_MAX_LENGTH = 80;

export type ChildValidationCode =
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_INVALID"
  | "DISPLAY_NAME_TOO_LONG"
  | "UNKNOWN_FIELD";

export class ChildValidationError extends Error {
  constructor(readonly code: ChildValidationCode) {
    super("Invalid child creation request.");
    this.name = "ChildValidationError";
  }
}

export class ChildMutationValidationError extends ChildValidationError {
  constructor(code: ChildValidationCode) {
    super(code);
    this.message = "Invalid child display name update request.";
    this.name = "ChildMutationValidationError";
  }
}

export type CreateChildInput = {
  displayName: string;
};

export type UpdateChildDisplayNameInput = {
  displayName: string;
};

const childDisplayNameInputSchema = z.strictObject({
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
          (value) => Array.from(value).length <= CHILD_DISPLAY_NAME_MAX_LENGTH,
          {
            message: "DISPLAY_NAME_TOO_LONG",
          },
        ),
    ),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseChildDisplayNameInput(
  value: unknown,
  errorFactory: (code: ChildValidationCode) => ChildValidationError,
): { displayName: string } {
  if (!isRecord(value)) {
    throw errorFactory("DISPLAY_NAME_REQUIRED");
  }

  if (Object.keys(value).some((key) => key !== "displayName")) {
    throw errorFactory("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "displayName")) {
    throw errorFactory("DISPLAY_NAME_REQUIRED");
  }

  if (typeof value.displayName !== "string") {
    throw errorFactory("DISPLAY_NAME_INVALID");
  }

  const result = childDisplayNameInputSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const validationCode = result.error.issues[0]?.message;

  throw errorFactory(
    validationCode === "DISPLAY_NAME_REQUIRED" ||
      validationCode === "DISPLAY_NAME_TOO_LONG"
      ? validationCode
      : "DISPLAY_NAME_INVALID",
  );
}

export function parseCreateChildInput(value: unknown): CreateChildInput {
  return parseChildDisplayNameInput(
    value,
    (code) => new ChildValidationError(code),
  );
}

export function parseUpdateChildDisplayNameInput(
  value: unknown,
): UpdateChildDisplayNameInput {
  return parseChildDisplayNameInput(
    value,
    (code) => new ChildMutationValidationError(code),
  );
}
