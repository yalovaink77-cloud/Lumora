import type { EmailIdentityPort } from "@lumora/family";

export type CanonicalizeEmail = (input: unknown) => string;

export class CanonicalEmailAdapter implements EmailIdentityPort {
  constructor(private readonly canonicalize: CanonicalizeEmail) {}

  canonicalizeEmail(email: string): string | null {
    try {
      return this.canonicalize(email);
    } catch {
      return null;
    }
  }
}
