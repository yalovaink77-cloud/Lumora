import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CHILD_DISPLAY_NAME_MAX_LENGTH,
  ChildMutationValidationError,
  ChildValidationError,
  parseCreateChildInput,
  parseUpdateChildDisplayNameInput,
} from "./child-validation";

function assertValidationCode(input: unknown, expectedCode: string): void {
  assert.throws(
    () => parseCreateChildInput(input),
    (error: unknown) =>
      error instanceof ChildValidationError && error.code === expectedCode,
  );
}

function assertMutationValidationCode(
  input: unknown,
  expectedCode: string,
): void {
  assert.throws(
    () => parseUpdateChildDisplayNameInput(input),
    (error: unknown) =>
      error instanceof ChildMutationValidationError &&
      error.code === expectedCode &&
      error.message === "Invalid child display name update request.",
  );
}

test("trims and accepts a valid Unicode displayName", () => {
  assert.deepEqual(
    parseCreateChildInput({
      displayName: "  Deniz 🌿  ",
    }),
    {
      displayName: "Deniz 🌿",
    },
  );
});

test("rejects missing, empty, whitespace-only, and non-string displayName", () => {
  assertValidationCode({}, "DISPLAY_NAME_REQUIRED");
  assertValidationCode(undefined, "DISPLAY_NAME_REQUIRED");
  assertValidationCode({ displayName: "" }, "DISPLAY_NAME_REQUIRED");
  assertValidationCode({ displayName: " \t\n " }, "DISPLAY_NAME_REQUIRED");
  assertValidationCode({ displayName: 42 }, "DISPLAY_NAME_INVALID");
});

test("accepts 80 Unicode code points and rejects 81", () => {
  const exactMaximum = "🌿".repeat(CHILD_DISPLAY_NAME_MAX_LENGTH);

  assert.equal(
    parseCreateChildInput({
      displayName: exactMaximum,
    }).displayName,
    exactMaximum,
  );

  assertValidationCode(
    {
      displayName: `${exactMaximum}🌿`,
    },
    "DISPLAY_NAME_TOO_LONG",
  );
});

test("rejects ownership, identity, and all other unknown fields", () => {
  for (const field of [
    "familyId",
    "userId",
    "membership",
    "role",
    "legalName",
    "birthDate",
    "gender",
    "guardianId",
    "pregnancyId",
    "status",
    "medicalId",
    "ownerId",
    "createdAt",
    "updatedAt",
  ]) {
    assertValidationCode(
      {
        displayName: "Deniz",
        [field]: "client-supplied",
      },
      "UNKNOWN_FIELD",
    );
  }
});

test("mutation trims valid Unicode and enforces the 80-code-point boundary", () => {
  assert.deepEqual(
    parseUpdateChildDisplayNameInput({
      displayName: "  Yeni Etiket 🌿  ",
    }),
    {
      displayName: "Yeni Etiket 🌿",
    },
  );

  const exactMaximum = "🌿".repeat(CHILD_DISPLAY_NAME_MAX_LENGTH);
  assert.equal(
    parseUpdateChildDisplayNameInput({
      displayName: exactMaximum,
    }).displayName,
    exactMaximum,
  );
  assertMutationValidationCode(
    {
      displayName: `${exactMaximum}🌿`,
    },
    "DISPLAY_NAME_TOO_LONG",
  );
});

test("mutation rejects missing, invalid, empty, and unknown fields", () => {
  assertMutationValidationCode({}, "DISPLAY_NAME_REQUIRED");
  assertMutationValidationCode({ displayName: 42 }, "DISPLAY_NAME_INVALID");
  assertMutationValidationCode({ displayName: "" }, "DISPLAY_NAME_REQUIRED");
  assertMutationValidationCode(
    { displayName: " \t\n " },
    "DISPLAY_NAME_REQUIRED",
  );

  for (const field of [
    "id",
    "familyId",
    "childId",
    "createdAt",
    "updatedAt",
    "userId",
    "role",
    "guardianId",
    "ownerId",
    "legalName",
    "birthDate",
    "gender",
    "medicalId",
    "pregnancyId",
  ]) {
    assertMutationValidationCode(
      {
        displayName: "Deniz",
        [field]: "client-supplied",
      },
      "UNKNOWN_FIELD",
    );
  }
});
