import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ChildClientValidationError,
  parseCreateChildInput,
  parseUpdateChildDisplayNameInput,
  unicodeCodePointLength,
} from "./child-validation";

test("create validation requires displayName", () => {
  assert.throws(
    () => parseCreateChildInput({}),
    (error: unknown) =>
      error instanceof ChildClientValidationError &&
      error.code === "DISPLAY_NAME_REQUIRED",
  );
});

test("create validation rejects whitespace-only displayName", () => {
  assert.throws(
    () => parseCreateChildInput({ displayName: "   \t  " }),
    (error: unknown) =>
      error instanceof ChildClientValidationError &&
      error.code === "DISPLAY_NAME_REQUIRED",
  );
});

test("create validation trims leading and trailing whitespace", () => {
  assert.deepEqual(parseCreateChildInput({ displayName: "  Ada  " }), {
    displayName: "Ada",
  });
});

test("create validation accepts exactly 80 Unicode code points", () => {
  const displayName = "a".repeat(80);
  assert.equal(unicodeCodePointLength(displayName), 80);
  assert.deepEqual(parseCreateChildInput({ displayName }), {
    displayName,
  });
});

test("create validation rejects 81 Unicode code points", () => {
  assert.throws(
    () => parseCreateChildInput({ displayName: "a".repeat(81) }),
    (error: unknown) =>
      error instanceof ChildClientValidationError &&
      error.code === "DISPLAY_NAME_TOO_LONG",
  );
});

test("create validation counts emoji as one code point each", () => {
  const emojiName = `${"😀".repeat(79)}x`;
  assert.equal(unicodeCodePointLength(emojiName), 80);
  assert.deepEqual(parseCreateChildInput({ displayName: emojiName }), {
    displayName: emojiName,
  });
  assert.throws(
    () => parseCreateChildInput({ displayName: "😀".repeat(81) }),
    (error: unknown) =>
      error instanceof ChildClientValidationError &&
      error.code === "DISPLAY_NAME_TOO_LONG",
  );
});

test("create validation rejects unknown fields", () => {
  assert.throws(
    () =>
      parseCreateChildInput({
        displayName: "Ok",
        birthDate: "2020-01-01",
      }),
    (error: unknown) =>
      error instanceof ChildClientValidationError &&
      error.code === "UNKNOWN_FIELD",
  );
});

test("update validation mirrors create and allows same-value labels", () => {
  assert.deepEqual(
    parseUpdateChildDisplayNameInput({ displayName: "  Same  " }),
    { displayName: "Same" },
  );
  assert.deepEqual(parseUpdateChildDisplayNameInput({ displayName: "Same" }), {
    displayName: "Same",
  });
  assert.throws(
    () => parseUpdateChildDisplayNameInput({ displayName: "a".repeat(81) }),
    (error: unknown) =>
      error instanceof ChildClientValidationError &&
      error.code === "DISPLAY_NAME_TOO_LONG",
  );
  assert.throws(
    () =>
      parseUpdateChildDisplayNameInput({
        displayName: "Ok",
        familyId: "fam_1",
      }),
    (error: unknown) =>
      error instanceof ChildClientValidationError &&
      error.code === "UNKNOWN_FIELD",
  );
});
