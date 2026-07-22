import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getPrismaClient } from "@lumora/database";

import type { AuthRuntimeConfig } from "./auth-config.js";
import { canonicalizeEmail } from "./canonical-email.js";
import { sessionResponseRedaction } from "./session-response-redaction.js";
import {
  composeVerificationEmailDeliveryInput,
  EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
} from "./verification-message.js";

export function buildAuthOptions(config: AuthRuntimeConfig) {
  return {
    appName: "Lumora",
    secret: config.secret,
    baseURL: config.baseUrl,
    trustedOrigins: config.trustedOrigins,
    basePath: "/api/auth",
    database: prismaAdapter(getPrismaClient(), {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
      async sendVerificationEmail({
        user,
        token,
      }: {
        user: { email: string };
        url: string;
        token: string;
      }) {
        const message = composeVerificationEmailDeliveryInput({
          recipient: canonicalizeEmail(user.email),
          confirmationPageUrl: config.delivery.confirmationPageUrl,
          token,
        });

        try {
          await config.delivery.adapter.deliver(message);
        } catch {
          // Delivery outcomes must not alter registration or resend responses.
          // Production adapter availability is validated before startup.
        }
      },
    },
    plugins: [sessionResponseRedaction],
    telemetry: {
      enabled: false,
    },
    advanced: {
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.secureCookies,
      },
    },
  } satisfies BetterAuthOptions;
}

export function createAuth(config: AuthRuntimeConfig) {
  return betterAuth(buildAuthOptions(config));
}

export type LumoraAuth = ReturnType<typeof createAuth>;
