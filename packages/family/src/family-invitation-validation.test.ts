import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAMILY_INVITATION_SECRET_LENGTH,
  FamilyInvitationAcceptanceValidationError,
  FamilyInvitationCreationValidationError,
  parseAcceptFamilyInvitationInput,
  parseCreateFamilyInvitationInput,
} from "./family-invitation-validation";

const validSecret = "A".repeat(FAMILY_INVITATION_SECRET_LENGTH);

test("creation validation preserves email exactly without trimming", () => {
  assert.deepEqual(
    parseCreateFamilyInvitationInput({ email: " Member@Example.com " }),
    { email: " Member@Example.com " },
  );
});

test("creation validation applies unknown, required, invalid precedence", () => {
  assert.throws(
    () => parseCreateFamilyInvitationInput({ extra: true }),
    (error: unknown) =>
      error instanceof FamilyInvitationCreationValidationError &&
      error.code === "UNKNOWN_FIELD" &&
      error.message === "Invalid Family invitation request.",
  );
  assert.throws(
    () => parseCreateFamilyInvitationInput({}),
    (error: unknown) =>
      error instanceof FamilyInvitationCreationValidationError &&
      error.code === "EMAIL_REQUIRED",
  );
  assert.throws(
    () => parseCreateFamilyInvitationInput({ email: "" }),
    (error: unknown) =>
      error instanceof FamilyInvitationCreationValidationError &&
      error.code === "EMAIL_REQUIRED",
  );
  assert.throws(
    () => parseCreateFamilyInvitationInput({ email: 1 }),
    (error: unknown) =>
      error instanceof FamilyInvitationCreationValidationError &&
      error.code === "EMAIL_INVALID",
  );
  assert.throws(
    () => parseCreateFamilyInvitationInput({ email: 1, extra: true }),
    (error: unknown) =>
      error instanceof FamilyInvitationCreationValidationError &&
      error.code === "UNKNOWN_FIELD",
  );
});

test("acceptance validation accepts only a 43-character unpadded base64url secret", () => {
  assert.deepEqual(
    parseAcceptFamilyInvitationInput({ invitationSecret: validSecret }),
    { invitationSecret: validSecret },
  );

  for (const invitationSecret of [
    "A".repeat(42),
    "A".repeat(44),
    `${"A".repeat(42)}=`,
    `${"A".repeat(42)}+`,
    `${"A".repeat(42)}/`,
    ` ${"A".repeat(42)}`,
  ]) {
    assert.throws(
      () => parseAcceptFamilyInvitationInput({ invitationSecret }),
      (error: unknown) =>
        error instanceof FamilyInvitationAcceptanceValidationError &&
        error.code === "INVITATION_SECRET_INVALID",
    );
  }
});

test("acceptance validation applies unknown, required, invalid precedence", () => {
  assert.throws(
    () => parseAcceptFamilyInvitationInput({ extra: true }),
    (error: unknown) =>
      error instanceof FamilyInvitationAcceptanceValidationError &&
      error.code === "UNKNOWN_FIELD" &&
      error.message === "Invalid Family invitation acceptance request.",
  );
  assert.throws(
    () => parseAcceptFamilyInvitationInput({}),
    (error: unknown) =>
      error instanceof FamilyInvitationAcceptanceValidationError &&
      error.code === "INVITATION_SECRET_REQUIRED",
  );
  assert.throws(
    () =>
      parseAcceptFamilyInvitationInput({
        invitationSecret: 1,
        extra: true,
      }),
    (error: unknown) =>
      error instanceof FamilyInvitationAcceptanceValidationError &&
      error.code === "UNKNOWN_FIELD",
  );
  assert.throws(
    () => parseAcceptFamilyInvitationInput({ invitationSecret: "" }),
    (error: unknown) =>
      error instanceof FamilyInvitationAcceptanceValidationError &&
      error.code === "INVITATION_SECRET_REQUIRED",
  );
});
