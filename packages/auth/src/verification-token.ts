import { jwtVerify } from "jose";
import { z } from "zod";

import { canonicalizeEmail } from "./canonical-email.js";

const verificationPayloadSchema = z
  .object({
    email: z.email(),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .strict();

export class InvalidEmailVerificationTokenError extends Error {
  override readonly name = "InvalidEmailVerificationTokenError";

  constructor() {
    super("This email verification link is invalid or expired.");
  }
}

export type PrevalidatedEmailVerificationToken = Readonly<{
  canonicalEmail: string;
  issuedAt: number;
  expiresAt: number;
}>;

export async function prevalidateEmailVerificationToken(
  token: string,
  secret: string,
): Promise<PrevalidatedEmailVerificationToken> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] },
    );
    const parsed = verificationPayloadSchema.parse(payload);

    if (parsed.exp <= parsed.iat) {
      throw new InvalidEmailVerificationTokenError();
    }

    return {
      canonicalEmail: canonicalizeEmail(parsed.email),
      issuedAt: parsed.iat,
      expiresAt: parsed.exp,
    };
  } catch {
    throw new InvalidEmailVerificationTokenError();
  }
}
