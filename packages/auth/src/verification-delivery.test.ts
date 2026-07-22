import assert from "node:assert/strict";
import { test } from "node:test";

import type { AuthRuntimeConfig } from "./auth-config.js";
import { buildAuthOptions } from "./create-auth.js";
import {
  InMemoryVerificationEmailCaptureAdapter,
  VERIFICATION_EMAIL_TEMPLATE_ID,
  type VerificationEmailDeliveryPort,
} from "./verification-delivery.js";
import {
  buildVerificationConfirmationUrl,
  composeVerificationEmailDeliveryInput,
} from "./verification-message.js";

function config(adapter: VerificationEmailDeliveryPort): AuthRuntimeConfig {
  return {
    secret: "unit-test-secret-value-with-32-chars-minimum",
    baseUrl: "http://localhost:3000",
    trustedOrigins: ["http://localhost:3000"],
    secureCookies: false,
    delivery: {
      mode: "capture",
      confirmationPageUrl: "http://localhost:3000/verify-email",
      adapter,
    },
  };
}

test("confirmation URL uses a fixed fragment and encodes the token", () => {
  assert.equal(
    buildVerificationConfirmationUrl(
      "https://lumora.example/verify-email",
      "a+b/c=d",
    ),
    "https://lumora.example/verify-email#token=a%2Bb%2Fc%3Dd",
  );
});

test("delivery composition contains only neutral allowed fields", () => {
  const message = composeVerificationEmailDeliveryInput({
    recipient: "user@example.com",
    confirmationPageUrl: "https://lumora.example/verify-email",
    token: "secret-token",
  });

  assert.deepEqual(Object.keys(message).sort(), [
    "confirmationUrl",
    "expiresInSeconds",
    "recipient",
    "templateId",
  ]);
  assert.equal(message.expiresInSeconds, 900);
  assert.equal(message.templateId, VERIFICATION_EMAIL_TEMPLATE_ID);
  assert.doesNotMatch(JSON.stringify(message), /family|invitation|role/i);
});

test("capture adapters are silent and isolated", async () => {
  const first = new InMemoryVerificationEmailCaptureAdapter();
  const second = new InMemoryVerificationEmailCaptureAdapter();
  const message = composeVerificationEmailDeliveryInput({
    recipient: "user@example.com",
    confirmationPageUrl: "http://localhost/verify-email",
    token: "token",
  });

  await first.deliver(message);
  assert.equal(first.messages.length, 1);
  assert.equal(second.messages.length, 0);
  first.clear();
  assert.equal(first.messages.length, 0);
});

test("Better Auth verification config and callback use only trusted inputs", async () => {
  const capture = new InMemoryVerificationEmailCaptureAdapter();
  const options = buildAuthOptions(config(capture));

  assert.equal(options.emailVerification.sendOnSignUp, true);
  assert.equal(options.emailVerification.sendOnSignIn, false);
  assert.equal(options.emailVerification.autoSignInAfterVerification, false);
  assert.equal(options.emailVerification.expiresIn, 900);
  assert.equal(options.emailAndPassword.requireEmailVerification, false);

  await options.emailVerification.sendVerificationEmail({
    user: { email: "User@EXAMPLE.com" },
    token: "trusted token",
    url: "https://attacker.example/redirect?token=ignored",
  });

  assert.deepEqual(capture.messages, [
    {
      recipient: "user@example.com",
      confirmationUrl:
        "http://localhost:3000/verify-email#token=trusted%20token",
      expiresInSeconds: 900,
      templateId: VERIFICATION_EMAIL_TEMPLATE_ID,
    },
  ]);
});

test("delivery failures do not alter authentication responses", async () => {
  const options = buildAuthOptions(
    config({
      async deliver() {
        throw new Error("provider detail");
      },
    }),
  );

  await assert.doesNotReject(() =>
    options.emailVerification.sendVerificationEmail({
      user: { email: "user@example.com" },
      token: "token",
      url: "https://ignored.example",
    }),
  );
});
