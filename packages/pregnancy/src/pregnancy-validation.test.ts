import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PREGNANCY_DISPLAY_NAME_MAX_LENGTH,
  PregnancyValidationError,
  parseCreatePregnancyInput,
} from "./pregnancy-validation";

function assertValidationCode(input: unknown, expectedCode: string): void {
  assert.throws(
    () => parseCreatePregnancyInput(input),
    (error: unknown) =>
      error instanceof PregnancyValidationError && error.code === expectedCode,
  );
}

test("trims and accepts a valid Unicode displayName", () => {
  assert.deepEqual(
    parseCreatePregnancyInput({
      displayName: "  Minik Yolculuk 🌿  ",
    }),
    {
      displayName: "Minik Yolculuk 🌿",
    },
  );
});

test("rejects a missing displayName", () => {
  assertValidationCode({}, "DISPLAY_NAME_REQUIRED");
  assertValidationCode(undefined, "DISPLAY_NAME_REQUIRED");
});

test("rejects an empty or whitespace-only displayName", () => {
  assertValidationCode({ displayName: "" }, "DISPLAY_NAME_REQUIRED");
  assertValidationCode({ displayName: " \t\n " }, "DISPLAY_NAME_REQUIRED");
});

test("rejects a non-string displayName", () => {
  assertValidationCode({ displayName: 42 }, "DISPLAY_NAME_INVALID");
});

test("accepts 100 Unicode code points and rejects 101", () => {
  const exactMaximum = "🌿".repeat(PREGNANCY_DISPLAY_NAME_MAX_LENGTH);

  assert.equal(
    parseCreatePregnancyInput({
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

test("rejects every unknown creation field", () => {
  for (const field of [
    "familyId",
    "userId",
    "membership",
    "role",
    "estimatedDueDate",
    "status",
    "childId",
    "createdAt",
    "updatedAt",
  ]) {
    assertValidationCode(
      {
        displayName: "Journey",
        [field]: "client-supplied",
      },
      "UNKNOWN_FIELD",
    );
  }
});
