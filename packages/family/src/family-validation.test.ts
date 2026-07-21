import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAMILY_DISPLAY_NAME_MAX_LENGTH,
  FamilyValidationError,
  parseCreateFamilyInput,
} from "./family-validation";

function assertValidationCode(input: unknown, expectedCode: string): void {
  assert.throws(
    () => parseCreateFamilyInput(input),
    (error: unknown) =>
      error instanceof FamilyValidationError && error.code === expectedCode,
  );
}

test("trims and accepts a valid Unicode displayName", () => {
  assert.deepEqual(
    parseCreateFamilyInput({
      displayName: "  Yıldız Ailesi 👨‍👩‍👧  ",
    }),
    {
      displayName: "Yıldız Ailesi 👨‍👩‍👧",
    },
  );
});

test("rejects a missing displayName", () => {
  assertValidationCode({}, "DISPLAY_NAME_REQUIRED");
});

test("rejects an empty or whitespace-only displayName", () => {
  assertValidationCode({ displayName: "" }, "DISPLAY_NAME_REQUIRED");
  assertValidationCode({ displayName: " \t\n " }, "DISPLAY_NAME_REQUIRED");
});

test("rejects a non-string displayName", () => {
  assertValidationCode({ displayName: 42 }, "DISPLAY_NAME_INVALID");
});

test("accepts 100 Unicode code points and rejects 101", () => {
  assert.equal(
    parseCreateFamilyInput({
      displayName: "🌿".repeat(FAMILY_DISPLAY_NAME_MAX_LENGTH),
    }).displayName,
    "🌿".repeat(FAMILY_DISPLAY_NAME_MAX_LENGTH),
  );

  assertValidationCode(
    {
      displayName: "🌿".repeat(FAMILY_DISPLAY_NAME_MAX_LENGTH + 1),
    },
    "DISPLAY_NAME_TOO_LONG",
  );
});

test("rejects unknown fields", () => {
  assertValidationCode(
    {
      displayName: "Family",
      role: "OWNER",
    },
    "UNKNOWN_FIELD",
  );
});
