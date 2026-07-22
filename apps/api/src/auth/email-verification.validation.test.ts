import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertEmptyEmailVerificationRequestBody,
  InvalidEmailVerificationRequestError,
  parseEmailVerificationConfirmationBody,
} from "./email-verification.validation";

test("request body accepts only no body or an empty object", () => {
  assert.doesNotThrow(() => assertEmptyEmailVerificationRequestBody(undefined));
  assert.doesNotThrow(() => assertEmptyEmailVerificationRequestBody({}));
  assert.throws(
    () =>
      assertEmptyEmailVerificationRequestBody({ email: "target@example.test" }),
    InvalidEmailVerificationRequestError,
  );
  assert.throws(
    () => assertEmptyEmailVerificationRequestBody([]),
    InvalidEmailVerificationRequestError,
  );
});

test("confirmation body accepts exactly one non-empty token", () => {
  assert.deepEqual(
    parseEmailVerificationConfirmationBody({ token: "opaque" }),
    {
      token: "opaque",
    },
  );
  assert.throws(
    () => parseEmailVerificationConfirmationBody({ token: "" }),
    InvalidEmailVerificationRequestError,
  );
  assert.throws(
    () =>
      parseEmailVerificationConfirmationBody({
        token: "opaque",
        email: "target@example.test",
      }),
    InvalidEmailVerificationRequestError,
  );
  assert.throws(
    () => parseEmailVerificationConfirmationBody(undefined),
    InvalidEmailVerificationRequestError,
  );
});
