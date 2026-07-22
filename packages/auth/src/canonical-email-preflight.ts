import { getPrismaClient } from "@lumora/database";

import {
  canonicalizeEmail,
  InvalidCanonicalEmailError,
} from "./canonical-email.js";

type StoredUserEmail = Readonly<{ id: string; email: string }>;

export class InvalidStoredUserEmailError extends Error {
  override readonly name = "InvalidStoredUserEmailError";

  constructor() {
    super("A stored User email is invalid.");
  }
}

export class NoncanonicalStoredUserEmailError extends Error {
  override readonly name = "NoncanonicalStoredUserEmailError";

  constructor() {
    super("A stored User email is not canonical.");
  }
}

export class CollidingStoredUserEmailError extends Error {
  override readonly name = "CollidingStoredUserEmailError";

  constructor() {
    super("Stored User emails collide after canonicalization.");
  }
}

export function assertCanonicalUserEmailRows(
  users: readonly StoredUserEmail[],
): void {
  const ownerByCanonicalEmail = new Map<string, string>();

  for (const user of users) {
    let canonicalEmail: string;

    try {
      canonicalEmail = canonicalizeEmail(user.email);
    } catch (error) {
      if (error instanceof InvalidCanonicalEmailError) {
        throw new InvalidStoredUserEmailError();
      }
      throw error;
    }

    if (canonicalEmail !== user.email) {
      throw new NoncanonicalStoredUserEmailError();
    }

    const existingOwner = ownerByCanonicalEmail.get(canonicalEmail);
    if (existingOwner !== undefined && existingOwner !== user.id) {
      throw new CollidingStoredUserEmailError();
    }

    ownerByCanonicalEmail.set(canonicalEmail, user.id);
  }
}

export async function preflightCanonicalUserEmails(): Promise<void> {
  const users = await getPrismaClient().user.findMany({
    select: { id: true, email: true },
  });

  assertCanonicalUserEmailRows(users);
}
