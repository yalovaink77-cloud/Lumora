import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  type ChildApplicationService,
  ChildValidationError,
} from "@lumora/child";

import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { ChildController } from "./child.controller";

const principal: AuthenticatedPrincipal = {
  id: "authenticated-user",
  email: "user@example.test",
  name: "Test User",
};

const now = new Date("2026-07-22T12:00:00.000Z");

test("creates a Child from route Family scope and neutral principal only", async () => {
  let receivedFamilyId = "";
  let receivedUserId = "";
  let receivedInput: unknown;
  const service = {
    createChild: async (familyId: string, userId: string, input: unknown) => {
      receivedFamilyId = familyId;
      receivedUserId = userId;
      receivedInput = input;

      return {
        id: "child-1",
        familyId,
        displayName: "Deniz",
        createdAt: now,
        updatedAt: now,
      };
    },
  } as unknown as ChildApplicationService;
  const controller = new ChildController(service);

  const response = await controller.createChild(
    "family-1",
    {
      displayName: "Deniz",
    },
    principal,
  );

  assert.equal(receivedFamilyId, "family-1");
  assert.equal(receivedUserId, "authenticated-user");
  assert.deepEqual(receivedInput, {
    displayName: "Deniz",
  });
  assert.deepEqual(response, {
    id: "child-1",
    familyId: "family-1",
    displayName: "Deniz",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  assert.deepEqual(Object.keys(response), [
    "id",
    "familyId",
    "displayName",
    "createdAt",
    "updatedAt",
  ]);
});

test("returns only scoped minimum representations from list", async () => {
  const service = {
    listChildren: async () => [
      {
        id: "child-1",
        familyId: "family-1",
        displayName: "Deniz",
        createdAt: now,
        updatedAt: now,
      },
    ],
  } as unknown as ChildApplicationService;
  const controller = new ChildController(service);

  assert.deepEqual(await controller.listChildren("family-1", principal), {
    children: [
      {
        id: "child-1",
        familyId: "family-1",
        displayName: "Deniz",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ],
  });
});

test("maps missing and inaccessible Families to one response", async () => {
  const service = {
    createChild: async () => null,
    listChildren: async () => null,
  } as unknown as ChildApplicationService;
  const controller = new ChildController(service);
  const expectedResponse = {
    statusCode: 404,
    code: "FAMILY_NOT_FOUND",
    message: "Family not found.",
  };

  await assert.rejects(
    () =>
      controller.createChild(
        "unavailable-family",
        {
          displayName: "Deniz",
        },
        principal,
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual(error.getResponse(), expectedResponse);
      return true;
    },
  );
  await assert.rejects(
    () => controller.listChildren("unavailable-family", principal),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual(error.getResponse(), expectedResponse);
      return true;
    },
  );
});

test("maps every unavailable scoped Child to one response", async () => {
  const service = {
    getChild: async () => null,
  } as unknown as ChildApplicationService;
  const controller = new ChildController(service);

  for (const [familyId, childId] of [
    ["family-1", "unknown-child"],
    ["inaccessible-family", "inaccessible-child"],
    ["family-1", "child-from-family-2"],
  ] as const) {
    await assert.rejects(
      () => controller.getChild(familyId, childId, principal),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.deepEqual(error.getResponse(), {
          statusCode: 404,
          code: "CHILD_NOT_FOUND",
          message: "Child not found.",
        });
        return true;
      },
    );
  }
});

test("maps Child validation failures to safe HTTP 400 responses", async () => {
  const service = {
    createChild: async () => {
      throw new ChildValidationError("UNKNOWN_FIELD");
    },
  } as unknown as ChildApplicationService;
  const controller = new ChildController(service);

  await assert.rejects(
    () =>
      controller.createChild(
        "family-1",
        {
          displayName: "Deniz",
          ownerId: "client-owner",
        },
        principal,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.deepEqual(error.getResponse(), {
        statusCode: 400,
        code: "UNKNOWN_FIELD",
        message: "Invalid child creation request.",
      });
      return true;
    },
  );
});
