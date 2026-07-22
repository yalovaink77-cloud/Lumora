import assert from "node:assert/strict";
import { test } from "node:test";

import { SignJWT } from "jose";

import {
  confirmAuthenticatedEmailVerification,
  issueAuthenticatedSelfVerification,
  type EmailVerificationAuthApi,
} from "./verification-service.js";
import {
  InvalidEmailVerificationTokenError,
  prevalidateEmailVerificationToken,
} from "./verification-token.js";

const secret = "unit-test-secret-value-with-32-chars-minimum";
const key = new TextEncoder().encode(secret);

async function sign(
  payload: Record<string, unknown> = { email: "User@EXAMPLE.com" },
  options?: { algorithm?: "HS256" | "HS384"; expiresAt?: number },
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: options?.algorithm ?? "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(options?.expiresAt ?? now + 900)
    .sign(key);
}

test("JOSE prevalidation accepts HS256 and canonicalizes the signed email", async () => {
  const result = await prevalidateEmailVerificationToken(await sign(), secret);
  assert.equal(result.canonicalEmail, "user@example.com");
  assert.equal(result.expiresAt - result.issuedAt, 900);
});

test("JOSE prevalidation rejects expired, tampered, and unsupported tokens", async () => {
  const expired = await sign(undefined, {
    expiresAt: Math.floor(Date.now() / 1000) - 1,
  });
  const valid = await sign();
  const [header, payload, signature] = valid.split(".");
  assert.ok(header && payload && signature);
  const tamperedPayload = `${payload[0] === "a" ? "b" : "a"}${payload.slice(1)}`;
  const tampered = `${header}.${tamperedPayload}.${signature}`;
  const hs384 = await sign(undefined, { algorithm: "HS384" });

  for (const token of [expired, tampered, hs384, "malformed"]) {
    await assert.rejects(
      () => prevalidateEmailVerificationToken(token, secret),
      InvalidEmailVerificationTokenError,
    );
  }
});

test("JOSE prevalidation rejects extra change-email claims", async () => {
  for (const payload of [
    { email: "user@example.com", updateTo: "other@example.com" },
    {
      email: "user@example.com",
      requestType: "change-email-verification",
    },
  ]) {
    const token = await sign(payload);
    await assert.rejects(
      () => prevalidateEmailVerificationToken(token, secret),
      InvalidEmailVerificationTokenError,
    );
  }
});

test("authenticated self-verification derives the canonical principal email", async () => {
  const calls: unknown[] = [];
  const auth: EmailVerificationAuthApi = {
    api: {
      async sendVerificationEmail(input) {
        calls.push(input);
      },
      async verifyEmail() {},
    },
  };

  assert.deepEqual(
    await issueAuthenticatedSelfVerification({
      auth,
      principal: { email: "User@EXAMPLE.com", emailVerified: false },
    }),
    { status: "accepted" },
  );
  assert.deepEqual(calls, [{ body: { email: "user@example.com" } }]);

  await issueAuthenticatedSelfVerification({
    auth,
    principal: { email: "user@example.com", emailVerified: true },
  });
  assert.equal(calls.length, 1);
});

test("authenticated self-verification remains neutral on delivery failure", async () => {
  const auth: EmailVerificationAuthApi = {
    api: {
      async sendVerificationEmail() {
        throw new Error("provider detail");
      },
      async verifyEmail() {},
    },
  };

  assert.deepEqual(
    await issueAuthenticatedSelfVerification({
      auth,
      principal: { email: "user@example.com", emailVerified: false },
    }),
    { status: "accepted" },
  );
});

test("authenticated confirmation binds subject and omits callback URL", async () => {
  const calls: unknown[] = [];
  const auth: EmailVerificationAuthApi = {
    api: {
      async sendVerificationEmail() {},
      async verifyEmail(input) {
        calls.push(input);
      },
    },
  };
  const token = await sign();

  assert.deepEqual(
    await confirmAuthenticatedEmailVerification({
      auth,
      principal: { email: "user@example.com", emailVerified: false },
      token,
      secret,
    }),
    { status: "verified" },
  );
  assert.deepEqual(calls, [{ query: { token } }]);
});

test("confirmation maps mismatch and Better Auth failures to invalid", async () => {
  const token = await sign();
  const failingAuth: EmailVerificationAuthApi = {
    api: {
      async sendVerificationEmail() {},
      async verifyEmail() {
        throw new Error("internal detail");
      },
    },
  };

  await assert.rejects(
    () =>
      confirmAuthenticatedEmailVerification({
        auth: failingAuth,
        principal: { email: "other@example.com", emailVerified: false },
        token,
        secret,
      }),
    InvalidEmailVerificationTokenError,
  );
  await assert.rejects(
    () =>
      confirmAuthenticatedEmailVerification({
        auth: failingAuth,
        principal: { email: "user@example.com", emailVerified: true },
        token,
        secret,
      }),
    InvalidEmailVerificationTokenError,
  );
});
