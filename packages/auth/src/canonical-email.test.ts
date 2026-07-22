import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertCanonicalUserEmailRows,
  CollidingStoredUserEmailError,
  InvalidStoredUserEmailError,
  NoncanonicalStoredUserEmailError,
} from "./canonical-email-preflight.js";
import {
  canonicalizeEmail,
  InvalidCanonicalEmailError,
} from "./canonical-email.js";

test("canonicalizeEmail validates the original then lowercases only", () => {
  assert.equal(
    canonicalizeEmail("User.Name+tag@EXAMPLE.com"),
    "user.name+tag@example.com",
  );
  assert.equal(canonicalizeEmail("user.name@gmail.com"), "user.name@gmail.com");
});

test("canonicalizeEmail rejects whitespace and raw Unicode", () => {
  for (const value of [
    " user@example.com",
    "user@example.com ",
    "usér@example.com",
    "user@éxample.com",
  ]) {
    assert.throws(() => canonicalizeEmail(value), InvalidCanonicalEmailError);
  }
});

test("canonicalizeEmail does not normalize compatibility characters", () => {
  assert.throws(
    () => canonicalizeEmail("ｕｓｅｒ@example.com"),
    InvalidCanonicalEmailError,
  );
});

test("canonical email preflight is read-only validation", () => {
  assert.doesNotThrow(() =>
    assertCanonicalUserEmailRows([
      { id: "one", email: "one@example.com" },
      { id: "two", email: "two+tag@example.com" },
    ]),
  );
  assert.throws(
    () => assertCanonicalUserEmailRows([{ id: "one", email: "invalid" }]),
    InvalidStoredUserEmailError,
  );
  assert.throws(
    () =>
      assertCanonicalUserEmailRows([{ id: "one", email: "ONE@example.com" }]),
    NoncanonicalStoredUserEmailError,
  );
  assert.throws(
    () =>
      assertCanonicalUserEmailRows([
        { id: "one", email: "same@example.com" },
        { id: "two", email: "same@example.com" },
      ]),
    CollidingStoredUserEmailError,
  );
});
