import { z } from "zod";

const emailSchema = z.email();

export class InvalidCanonicalEmailError extends Error {
  override readonly name = "InvalidCanonicalEmailError";

  constructor() {
    super("Email is not a valid canonical email address.");
  }
}

export function canonicalizeEmail(input: unknown): string {
  const result = emailSchema.safeParse(input);

  if (!result.success) {
    throw new InvalidCanonicalEmailError();
  }

  return result.data.toLowerCase();
}
