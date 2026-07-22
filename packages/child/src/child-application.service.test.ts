import assert from "node:assert/strict";
import { test } from "node:test";

import { ChildApplicationService } from "./child-application.service";
import type {
  Child,
  ChildRepository,
  CreateChildPersistenceInput,
  UpdateChildDisplayNamePersistenceInput,
} from "./child.types";

class RecordingChildRepository implements ChildRepository {
  readonly createInputs: CreateChildPersistenceInput[] = [];
  readonly updateInputs: UpdateChildDisplayNamePersistenceInput[] = [];

  async createChildForMember(
    input: CreateChildPersistenceInput,
  ): Promise<Child> {
    this.createInputs.push(input);
    const now = new Date("2026-07-22T00:00:00.000Z");

    return {
      id: `child-${this.createInputs.length}`,
      familyId: input.familyId,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now,
    };
  }

  async findChildrenForMember(): Promise<Child[]> {
    return [];
  }

  async findChildForMember(): Promise<Child | null> {
    return null;
  }

  async updateChildDisplayNameForMember(
    input: UpdateChildDisplayNamePersistenceInput,
  ): Promise<Child> {
    this.updateInputs.push(input);

    return {
      id: input.childId,
      familyId: input.familyId,
      displayName: input.displayName,
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
      updatedAt: new Date("2026-07-22T01:00:00.000Z"),
    };
  }
}

test("creates a Child from Family scope and neutral user identity", async () => {
  const repository = new RecordingChildRepository();
  const service = new ChildApplicationService(repository);

  const child = await service.createChild("family-1", "authenticated-user", {
    displayName: "  Deniz  ",
  });

  assert.deepEqual(repository.createInputs, [
    {
      familyId: "family-1",
      userId: "authenticated-user",
      displayName: "Deniz",
    },
  ]);
  assert.equal(child?.familyId, "family-1");
});

test("allows duplicate displayName values in one Family", async () => {
  const repository = new RecordingChildRepository();
  const service = new ChildApplicationService(repository);

  await service.createChild("family-1", "user-1", {
    displayName: "Deniz",
  });
  await service.createChild("family-1", "user-1", {
    displayName: "Deniz",
  });

  assert.equal(repository.createInputs.length, 2);
  assert.equal(repository.createInputs[0]?.displayName, "Deniz");
  assert.equal(repository.createInputs[1]?.displayName, "Deniz");
});

test("updates only a normalized displayName in authenticated Family scope", async () => {
  const repository = new RecordingChildRepository();
  const service = new ChildApplicationService(repository);

  const child = await service.updateChildDisplayName(
    "family-1",
    "child-1",
    "authenticated-user",
    {
      displayName: "  Yeni Etiket 🌿  ",
    },
  );

  assert.deepEqual(repository.updateInputs, [
    {
      familyId: "family-1",
      childId: "child-1",
      userId: "authenticated-user",
      displayName: "Yeni Etiket 🌿",
    },
  ]);
  assert.equal(child?.displayName, "Yeni Etiket 🌿");
});

test("rejects empty neutral and route identifiers", async () => {
  const service = new ChildApplicationService(new RecordingChildRepository());

  await assert.rejects(
    () =>
      service.createChild(" ", "user-1", {
        displayName: "Deniz",
      }),
    /familyId must not be empty/,
  );
  await assert.rejects(
    () =>
      service.createChild("family-1", " ", {
        displayName: "Deniz",
      }),
    /userId must not be empty/,
  );
  await assert.rejects(
    () => service.getChild("family-1", " ", "user-1"),
    /childId must not be empty/,
  );
  await assert.rejects(
    () =>
      service.updateChildDisplayName("family-1", "child-1", " ", {
        displayName: "Deniz",
      }),
    /userId must not be empty/,
  );
});
