import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FamilyClientValidationError,
  parseCreateFamilyInput,
  unicodeCodePointLength,
} from "./family-validation";

test("create validation requires displayName", () => {
  assert.throws(
    () => parseCreateFamilyInput({}),
    (error: unknown) =>
      error instanceof FamilyClientValidationError &&
      error.code === "DISPLAY_NAME_REQUIRED",
  );
});

test("create validation rejects whitespace-only displayName", () => {
  assert.throws(
    () => parseCreateFamilyInput({ displayName: "   \t  " }),
    (error: unknown) =>
      error instanceof FamilyClientValidationError &&
      error.code === "DISPLAY_NAME_REQUIRED",
  );
});

test("create validation trims leading and trailing whitespace for submission", () => {
  assert.deepEqual(parseCreateFamilyInput({ displayName: "  Ada Family  " }), {
    displayName: "Ada Family",
  });
});

test("create validation accepts exactly 100 Unicode code points", () => {
  const displayName = "a".repeat(100);
  assert.equal(unicodeCodePointLength(displayName), 100);
  assert.deepEqual(parseCreateFamilyInput({ displayName }), { displayName });
});

test("create validation rejects 101 Unicode code points", () => {
  const displayName = "a".repeat(101);
  assert.throws(
    () => parseCreateFamilyInput({ displayName }),
    (error: unknown) =>
      error instanceof FamilyClientValidationError &&
      error.code === "DISPLAY_NAME_TOO_LONG",
  );
});

test("create validation counts emoji/surrogate pairs as one code point each", () => {
  const emojiName = `${"😀".repeat(99)}x`;
  assert.equal(unicodeCodePointLength(emojiName), 100);
  assert.deepEqual(parseCreateFamilyInput({ displayName: emojiName }), {
    displayName: emojiName,
  });

  const tooLong = "😀".repeat(101);
  assert.equal(unicodeCodePointLength(tooLong), 101);
  assert.throws(
    () => parseCreateFamilyInput({ displayName: tooLong }),
    (error: unknown) =>
      error instanceof FamilyClientValidationError &&
      error.code === "DISPLAY_NAME_TOO_LONG",
  );
});

test("create validation rejects unknown fields", () => {
  assert.throws(
    () =>
      parseCreateFamilyInput({
        displayName: "Ok",
        role: "OWNER",
      }),
    (error: unknown) =>
      error instanceof FamilyClientValidationError &&
      error.code === "UNKNOWN_FIELD",
  );
});
