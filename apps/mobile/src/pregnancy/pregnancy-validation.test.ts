import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PregnancyClientValidationError,
  parseCreatePregnancyInput,
  unicodeCodePointLength,
} from "./pregnancy-validation";

test("create validation requires displayName", () => {
  assert.throws(
    () => parseCreatePregnancyInput({}),
    (error: unknown) =>
      error instanceof PregnancyClientValidationError &&
      error.code === "DISPLAY_NAME_REQUIRED",
  );
});

test("create validation rejects whitespace-only displayName", () => {
  assert.throws(
    () => parseCreatePregnancyInput({ displayName: "   \t  " }),
    (error: unknown) =>
      error instanceof PregnancyClientValidationError &&
      error.code === "DISPLAY_NAME_REQUIRED",
  );
});

test("create validation trims leading and trailing whitespace", () => {
  assert.deepEqual(parseCreatePregnancyInput({ displayName: "  Journey  " }), {
    displayName: "Journey",
  });
});

test("create validation accepts exactly 100 Unicode code points", () => {
  const displayName = "a".repeat(100);
  assert.equal(unicodeCodePointLength(displayName), 100);
  assert.deepEqual(parseCreatePregnancyInput({ displayName }), {
    displayName,
  });
});

test("create validation rejects 101 Unicode code points", () => {
  assert.throws(
    () => parseCreatePregnancyInput({ displayName: "a".repeat(101) }),
    (error: unknown) =>
      error instanceof PregnancyClientValidationError &&
      error.code === "DISPLAY_NAME_TOO_LONG",
  );
});

test("create validation counts emoji as one code point each", () => {
  const emojiName = `${"😀".repeat(99)}x`;
  assert.equal(unicodeCodePointLength(emojiName), 100);
  assert.deepEqual(parseCreatePregnancyInput({ displayName: emojiName }), {
    displayName: emojiName,
  });
  assert.throws(
    () => parseCreatePregnancyInput({ displayName: "😀".repeat(101) }),
    (error: unknown) =>
      error instanceof PregnancyClientValidationError &&
      error.code === "DISPLAY_NAME_TOO_LONG",
  );
});

test("create validation rejects unknown fields", () => {
  assert.throws(
    () =>
      parseCreatePregnancyInput({
        displayName: "Ok",
        trimester: 1,
      }),
    (error: unknown) =>
      error instanceof PregnancyClientValidationError &&
      error.code === "UNKNOWN_FIELD",
  );
});
