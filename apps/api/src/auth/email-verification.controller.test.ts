import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";

import { AuthService } from "./auth.service";
import { EmailVerificationController } from "./email-verification.controller";
import { EmailVerificationRateLimiter } from "./email-verification-rate-limiter";
import type { AuthenticatedPrincipal } from "./auth.types";

const principal: AuthenticatedPrincipal = {
  id: "user-1",
  email: "user@example.test",
  emailVerified: false,
  name: "Test User",
};

function request(): Request {
  return {
    ip: "127.0.0.1",
    socket: {},
  } as Request;
}

test("request endpoint derives its target only from the authenticated principal", async () => {
  let receivedPrincipal: unknown;
  const authService = {
    requestEmailVerification: async (value: unknown) => {
      receivedPrincipal = value;
      return { status: "accepted" as const };
    },
  } as unknown as AuthService;
  const controller = new EmailVerificationController(
    authService,
    new EmailVerificationRateLimiter(),
  );

  assert.deepEqual(
    await controller.requestVerification(principal, {}, request()),
    { status: "accepted" },
  );
  assert.equal(receivedPrincipal, principal);
});

test("request endpoint rejects caller-selected email fields", async () => {
  const controller = new EmailVerificationController(
    {} as AuthService,
    new EmailVerificationRateLimiter(),
  );

  await assert.rejects(
    () =>
      controller.requestVerification(
        principal,
        { email: "other@example.test" },
        request(),
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.deepEqual(error.getResponse(), {
        statusCode: 400,
        code: "INVALID_EMAIL_VERIFICATION_REQUEST",
        message: "Invalid email verification request.",
      });
      return true;
    },
  );
});

test("confirmation maps every token failure to one neutral response", async () => {
  const secretToken = "secret-token-not-for-errors";
  const authService = {
    confirmEmailVerification: async () => {
      throw new Error("internal detail");
    },
  } as unknown as AuthService;
  const controller = new EmailVerificationController(
    authService,
    new EmailVerificationRateLimiter(),
  );

  await assert.rejects(
    () =>
      controller.confirmVerification(
        principal,
        { token: secretToken },
        request(),
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = error.getResponse();
      assert.deepEqual(response, {
        statusCode: 400,
        code: "EMAIL_VERIFICATION_INVALID",
        message: "This email verification link is invalid or expired.",
      });
      assert.doesNotMatch(JSON.stringify(response), new RegExp(secretToken));
      return true;
    },
  );
});

test("matching confirmation returns the neutral success response", async () => {
  const authService = {
    confirmEmailVerification: async () => ({ status: "verified" as const }),
  } as unknown as AuthService;
  const controller = new EmailVerificationController(
    authService,
    new EmailVerificationRateLimiter(),
  );

  assert.deepEqual(
    await controller.confirmVerification(
      principal,
      { token: "opaque" },
      request(),
    ),
    { status: "verified" },
  );
});
