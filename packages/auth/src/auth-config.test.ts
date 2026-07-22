import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseTrustedOrigins,
  validateAuthRuntimeConfig,
} from "./auth-config.js";
import { InMemoryVerificationEmailCaptureAdapter } from "./verification-delivery.js";

const validEnv = {
  BETTER_AUTH_SECRET: "unit-test-secret-value-with-32-chars-minimum",
  BETTER_AUTH_URL: "http://localhost:3000",
  AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
  AUTH_EMAIL_VERIFICATION_DELIVERY_MODE: "capture",
  AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL:
    "http://localhost:3000/verify-email",
  NODE_ENV: "development",
};

const captureAdapter = new InMemoryVerificationEmailCaptureAdapter();

function validate(env: NodeJS.ProcessEnv = validEnv) {
  return validateAuthRuntimeConfig(env, {
    allowPlaceholderSecret: true,
    captureAdapter,
  });
}

test("validateAuthRuntimeConfig passes with valid configuration", () => {
  const config = validate();

  assert.equal(config.baseUrl, "http://localhost:3000");
  assert.deepEqual(config.trustedOrigins, ["http://localhost:3000"]);
  assert.equal(config.secureCookies, false);
  assert.equal(config.delivery.mode, "capture");
  assert.equal(
    config.delivery.confirmationPageUrl,
    "http://localhost:3000/verify-email",
  );
  assert.equal(config.delivery.adapter, captureAdapter);
});

test("validateAuthRuntimeConfig fails when BETTER_AUTH_SECRET is missing", () => {
  assert.throws(
    () =>
      validate({
        ...validEnv,
        BETTER_AUTH_SECRET: undefined,
      }),
    /BETTER_AUTH_SECRET is required/,
  );
});

test("validateAuthRuntimeConfig fails when BETTER_AUTH_SECRET is too short", () => {
  assert.throws(
    () =>
      validate({
        ...validEnv,
        BETTER_AUTH_SECRET: "too-short",
      }),
    /at least 32 characters/,
  );
});

test("validateAuthRuntimeConfig fails when BETTER_AUTH_URL is malformed", () => {
  assert.throws(
    () =>
      validate({
        ...validEnv,
        BETTER_AUTH_URL: "not-a-url",
      }),
    /valid absolute URL/,
  );
});

test("validateAuthRuntimeConfig error messages do not include secret values", () => {
  const secret = "unit-test-secret-value-with-32-chars-minimum";

  try {
    validate({
      ...validEnv,
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: ":::",
    });
    assert.fail("Expected validation to throw");
  } catch (error) {
    assert.match(String(error), /valid absolute URL/);
    assert.doesNotMatch(String(error), new RegExp(secret));
  }
});

test("parseTrustedOrigins rejects empty values", () => {
  assert.throws(() => parseTrustedOrigins(", ,"), /at least one origin/);
});

test("capture mode must be explicitly selected and injected", () => {
  assert.throws(
    () =>
      validate({
        ...validEnv,
        AUTH_EMAIL_VERIFICATION_DELIVERY_MODE: undefined,
      }),
    /DELIVERY_MODE is required/,
  );
  assert.throws(
    () =>
      validateAuthRuntimeConfig(validEnv, {
        allowPlaceholderSecret: true,
      }),
    /explicitly injected adapter/,
  );
});

test("production rejects capture mode", () => {
  assert.throws(
    () => validate({ ...validEnv, NODE_ENV: "production" }),
    /capture is allowed only in test or development/,
  );
});

test("confirmation page requires a trusted origin and local HTTP boundary", () => {
  assert.throws(
    () =>
      validate({
        ...validEnv,
        AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL:
          "https://untrusted.example/verify-email",
      }),
    /trusted origin/,
  );
  assert.throws(
    () =>
      validate({
        ...validEnv,
        AUTH_TRUSTED_ORIGINS: "http://remote.example",
        AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL:
          "http://remote.example/verify-email",
      }),
    /must use https outside local environments/,
  );
});

test("production mode requires HTTPS before failing closed without an adapter", () => {
  const productionEnv = {
    ...validEnv,
    NODE_ENV: "production",
    BETTER_AUTH_URL: "https://auth.lumora.example",
    AUTH_TRUSTED_ORIGINS: "https://lumora.example",
    AUTH_EMAIL_VERIFICATION_DELIVERY_MODE: "production",
  };

  assert.throws(
    () => validate(productionEnv),
    /CONFIRMATION_PAGE_URL must use https in production/,
  );
  assert.throws(
    () =>
      validate({
        ...productionEnv,
        AUTH_EMAIL_VERIFICATION_CONFIRMATION_PAGE_URL:
          "https://lumora.example/verify-email",
      }),
    /no configured production-capable adapter/,
  );
});
