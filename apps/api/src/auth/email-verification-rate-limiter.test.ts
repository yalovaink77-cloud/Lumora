import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { EmailVerificationRateLimiter } from "./email-verification-rate-limiter";

test("request rate limit applies per user and IP with a neutral response", () => {
  const limiter = new EmailVerificationRateLimiter();

  limiter.assertAllowed("request", "user-1", "127.0.0.1", 1);
  limiter.assertAllowed("request", "user-1", "127.0.0.1", 2);
  limiter.assertAllowed("request", "user-1", "127.0.0.1", 3);

  assert.throws(
    () => limiter.assertAllowed("request", "user-1", "127.0.0.1", 4),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      assert.equal(error.getStatus(), 429);
      assert.deepEqual(error.getResponse(), {
        statusCode: 429,
        code: "EMAIL_VERIFICATION_RATE_LIMITED",
        message: "Too many requests.",
      });
      return true;
    },
  );
});

test("confirmation rate limit resets after the approved window", () => {
  const limiter = new EmailVerificationRateLimiter();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    limiter.assertAllowed("confirm", "user-1", "127.0.0.1", attempt);
  }

  assert.throws(
    () => limiter.assertAllowed("confirm", "user-1", "127.0.0.1", 10),
    HttpException,
  );
  assert.doesNotThrow(() =>
    limiter.assertAllowed("confirm", "user-1", "127.0.0.1", 60_001),
  );
});

test("IP bucket prevents bypass through multiple users", () => {
  const limiter = new EmailVerificationRateLimiter();

  limiter.assertAllowed("request", "user-1", "shared-ip", 1);
  limiter.assertAllowed("request", "user-2", "shared-ip", 2);
  limiter.assertAllowed("request", "user-3", "shared-ip", 3);

  assert.throws(
    () => limiter.assertAllowed("request", "user-4", "shared-ip", 4),
    HttpException,
  );
});
