import assert from "node:assert/strict";
import { test } from "node:test";

import { PregnancyApplicationService } from "./pregnancy-application.service";
import type {
  CreatePregnancyPersistenceInput,
  Pregnancy,
  PregnancyRepository,
} from "./pregnancy.types";

class RecordingPregnancyRepository implements PregnancyRepository {
  readonly createInputs: CreatePregnancyPersistenceInput[] = [];

  async createPregnancyForMember(
    input: CreatePregnancyPersistenceInput,
  ): Promise<Pregnancy> {
    this.createInputs.push(input);
    const now = new Date("2026-07-21T00:00:00.000Z");

    return {
      id: `pregnancy-${this.createInputs.length}`,
      familyId: input.familyId,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now,
    };
  }

  async findPregnanciesForMember(): Promise<Pregnancy[] | null> {
    return [];
  }

  async findPregnancyForMember(): Promise<Pregnancy | null> {
    return null;
  }
}

test("creates a pregnancy from explicit Family scope and neutral user identity", async () => {
  const repository = new RecordingPregnancyRepository();
  const service = new PregnancyApplicationService(repository);

  const result = await service.createPregnancy(
    "family-1",
    "authenticated-user",
    {
      displayName: "  Minik Yolculuk  ",
    },
  );

  assert.deepEqual(repository.createInputs, [
    {
      familyId: "family-1",
      userId: "authenticated-user",
      displayName: "Minik Yolculuk",
    },
  ]);
  assert.equal(result?.familyId, "family-1");
});

test("allows duplicate displayName values in one Family", async () => {
  const repository = new RecordingPregnancyRepository();
  const service = new PregnancyApplicationService(repository);

  await service.createPregnancy("family-1", "user-1", {
    displayName: "Ortak Ad",
  });
  await service.createPregnancy("family-1", "user-1", {
    displayName: "Ortak Ad",
  });

  assert.equal(repository.createInputs.length, 2);
  assert.equal(repository.createInputs[0]?.displayName, "Ortak Ad");
  assert.equal(repository.createInputs[1]?.displayName, "Ortak Ad");
});

test("rejects empty neutral and route identifiers", async () => {
  const service = new PregnancyApplicationService(
    new RecordingPregnancyRepository(),
  );

  await assert.rejects(
    () =>
      service.createPregnancy(" ", "user-1", {
        displayName: "Journey",
      }),
    /familyId must not be empty/,
  );
  await assert.rejects(
    () =>
      service.createPregnancy("family-1", " ", {
        displayName: "Journey",
      }),
    /userId must not be empty/,
  );
  await assert.rejects(
    () => service.getPregnancy("family-1", " ", "user-1"),
    /pregnancyId must not be empty/,
  );
});
