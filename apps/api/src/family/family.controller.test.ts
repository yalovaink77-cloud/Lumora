import assert from "node:assert/strict";
import { test } from "node:test";

import { NotFoundException } from "@nestjs/common";
import type { FamilyApplicationService } from "@lumora/family";

import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { FamilyController } from "./family.controller";

const principal: AuthenticatedPrincipal = {
  id: "authenticated-user",
  email: "user@example.test",
  emailVerified: false,
  name: "Test User",
};

const now = new Date("2026-07-21T12:00:00.000Z");

test("creates a family from only the neutral principal identifier", async () => {
  let receivedUserId = "";
  let receivedInput: unknown;
  const service = {
    createFamily: async (userId: string, input: unknown) => {
      receivedUserId = userId;
      receivedInput = input;

      return {
        family: {
          id: "family-1",
          displayName: "Kaya Ailesi",
          createdAt: now,
          updatedAt: now,
        },
        membership: {
          id: "membership-1",
          familyId: "family-1",
          userId,
          role: "OWNER" as const,
          createdAt: now,
          updatedAt: now,
        },
      };
    },
  } as unknown as FamilyApplicationService;
  const controller = new FamilyController(service);

  const response = await controller.createFamily(
    {
      displayName: "Kaya Ailesi",
    },
    principal,
  );

  assert.equal(receivedUserId, "authenticated-user");
  assert.deepEqual(receivedInput, {
    displayName: "Kaya Ailesi",
  });
  assert.deepEqual(response, {
    family: {
      id: "family-1",
      displayName: "Kaya Ailesi",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    membership: {
      id: "membership-1",
      familyId: "family-1",
      userId: "authenticated-user",
      role: "OWNER",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  });
  assert.deepEqual(Object.keys(response.family), [
    "id",
    "displayName",
    "createdAt",
    "updatedAt",
  ]);
});

test("returns identical not-found errors for every absent scoped lookup", async () => {
  const service = {
    getFamily: async () => null,
  } as unknown as FamilyApplicationService;
  const controller = new FamilyController(service);

  for (const familyId of ["unknown-family", "inaccessible-family"]) {
    await assert.rejects(
      () => controller.getFamily(familyId, principal),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.deepEqual(error.getResponse(), {
          statusCode: 404,
          code: "FAMILY_NOT_FOUND",
          message: "Family not found.",
        });
        return true;
      },
    );
  }
});
