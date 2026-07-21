import assert from "node:assert/strict";
import { test } from "node:test";

import { FamilyApplicationService } from "./family-application.service";
import {
  FAMILY_OWNER_ROLE,
  type CreateFamilyPersistenceInput,
  type Family,
  type FamilyRepository,
} from "./family.types";

class RecordingFamilyRepository implements FamilyRepository {
  readonly createInputs: CreateFamilyPersistenceInput[] = [];

  async createFamilyWithMembership(input: CreateFamilyPersistenceInput) {
    this.createInputs.push(input);
    const now = new Date("2026-07-21T00:00:00.000Z");
    const familyId = `family-${this.createInputs.length}`;

    return {
      family: {
        id: familyId,
        displayName: input.displayName,
        createdAt: now,
        updatedAt: now,
      },
      membership: {
        id: `membership-${this.createInputs.length}`,
        familyId,
        userId: input.userId,
        role: input.role,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  async findFamiliesForUser(): Promise<Family[]> {
    return [];
  }

  async findFamilyForUser(): Promise<Family | null> {
    return null;
  }
}

test("creates a family using the authenticated user and OWNER role", async () => {
  const repository = new RecordingFamilyRepository();
  const service = new FamilyApplicationService(repository);

  const result = await service.createFamily("authenticated-user", {
    displayName: "  Kaya Ailesi  ",
  });

  assert.deepEqual(repository.createInputs, [
    {
      displayName: "Kaya Ailesi",
      role: FAMILY_OWNER_ROLE,
      userId: "authenticated-user",
    },
  ]);
  assert.equal(result.membership.role, FAMILY_OWNER_ROLE);
  assert.equal(result.membership.userId, "authenticated-user");
});

test("allows separate families to use the same displayName", async () => {
  const repository = new RecordingFamilyRepository();
  const service = new FamilyApplicationService(repository);

  await service.createFamily("user-1", {
    displayName: "Ortak Ad",
  });
  await service.createFamily("user-1", {
    displayName: "Ortak Ad",
  });

  assert.equal(repository.createInputs.length, 2);
  assert.equal(repository.createInputs[0]?.displayName, "Ortak Ad");
  assert.equal(repository.createInputs[1]?.displayName, "Ortak Ad");
});

test("rejects an empty neutral user identifier", async () => {
  const service = new FamilyApplicationService(new RecordingFamilyRepository());

  await assert.rejects(
    () =>
      service.createFamily(" ", {
        displayName: "Family",
      }),
    /userId must not be empty/,
  );
});
