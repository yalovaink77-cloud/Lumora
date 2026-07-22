export const FAMILY_INVITATION_SECRET_LENGTH = 43;
export const FAMILY_INVITATION_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type FamilyInvitationCreationValidationCode =
  "EMAIL_REQUIRED" | "EMAIL_INVALID" | "UNKNOWN_FIELD";

export type FamilyInvitationAcceptanceValidationCode =
  "INVITATION_SECRET_REQUIRED" | "INVITATION_SECRET_INVALID" | "UNKNOWN_FIELD";

export class FamilyInvitationCreationValidationError extends Error {
  constructor(readonly code: FamilyInvitationCreationValidationCode) {
    super("Invalid Family invitation request.");
    this.name = "FamilyInvitationCreationValidationError";
  }
}

export class FamilyInvitationAcceptanceValidationError extends Error {
  constructor(readonly code: FamilyInvitationAcceptanceValidationCode) {
    super("Invalid Family invitation acceptance request.");
    this.name = "FamilyInvitationAcceptanceValidationError";
  }
}

export class VerifiedEmailRequiredError extends Error {
  readonly code = "VERIFIED_EMAIL_REQUIRED" as const;

  constructor() {
    super("Verified email is required.");
    this.name = "VerifiedEmailRequiredError";
  }
}

export type CreateFamilyInvitationInput = {
  email: string;
};

export type AcceptFamilyInvitationInput = {
  invitationSecret: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseCreateFamilyInvitationInput(
  value: unknown,
): CreateFamilyInvitationInput {
  if (!isRecord(value)) {
    throw new FamilyInvitationCreationValidationError("EMAIL_REQUIRED");
  }

  if (Object.keys(value).some((key) => key !== "email")) {
    throw new FamilyInvitationCreationValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "email")) {
    throw new FamilyInvitationCreationValidationError("EMAIL_REQUIRED");
  }

  if (typeof value.email !== "string") {
    throw new FamilyInvitationCreationValidationError("EMAIL_INVALID");
  }

  if (value.email.length === 0) {
    throw new FamilyInvitationCreationValidationError("EMAIL_REQUIRED");
  }

  return { email: value.email };
}

export function parseAcceptFamilyInvitationInput(
  value: unknown,
): AcceptFamilyInvitationInput {
  if (!isRecord(value)) {
    throw new FamilyInvitationAcceptanceValidationError(
      "INVITATION_SECRET_REQUIRED",
    );
  }

  if (Object.keys(value).some((key) => key !== "invitationSecret")) {
    throw new FamilyInvitationAcceptanceValidationError("UNKNOWN_FIELD");
  }

  if (!Object.hasOwn(value, "invitationSecret")) {
    throw new FamilyInvitationAcceptanceValidationError(
      "INVITATION_SECRET_REQUIRED",
    );
  }

  if (typeof value.invitationSecret !== "string") {
    throw new FamilyInvitationAcceptanceValidationError(
      "INVITATION_SECRET_INVALID",
    );
  }

  if (value.invitationSecret.length === 0) {
    throw new FamilyInvitationAcceptanceValidationError(
      "INVITATION_SECRET_REQUIRED",
    );
  }

  if (!FAMILY_INVITATION_SECRET_PATTERN.test(value.invitationSecret)) {
    throw new FamilyInvitationAcceptanceValidationError(
      "INVITATION_SECRET_INVALID",
    );
  }

  return { invitationSecret: value.invitationSecret };
}
