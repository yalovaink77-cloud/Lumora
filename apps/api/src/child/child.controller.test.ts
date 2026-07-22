import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  type ChildApplicationService,
  ChildMutationValidationError,
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

test("updates a Child displayName from route scope and neutral principal", async () => {
  let receivedFamilyId = "";
  let receivedChildId = "";
  let receivedUserId = "";
  let receivedInput: unknown;
  const updatedAt = new Date("2026-07-22T13:00:00.000Z");
  const service = {
    updateChildDisplayName: async (
      familyId: string,
      childId: string,
      userId: string,
      input: unknown,
    ) => {
      receivedFamilyId = familyId;
      receivedChildId = childId;
      receivedUserId = userId;
      receivedInput = input;

      return {
        id: childId,
        familyId,
        displayName: "Yeni Etiket",
        createdAt: now,
        updatedAt,
      };
    },
  } as unknown as ChildApplicationService;
  const controller = new ChildController(service);

  const response = await controller.updateChildDisplayName(
    "family-1",
    "child-1",
    {
      displayName: "Yeni Etiket",
    },
    principal,
  );

  assert.equal(receivedFamilyId, "family-1");
  assert.equal(receivedChildId, "child-1");
  assert.equal(receivedUserId, "authenticated-user");
  assert.deepEqual(receivedInput, {
    displayName: "Yeni Etiket",
  });
  assert.deepEqual(response, {
    id: "child-1",
    familyId: "family-1",
    displayName: "Yeni Etiket",
    createdAt: now.toISOString(),
    updatedAt: updatedAt.toISOString(),
  });
});

test("maps every unavailable mutation target to CHILD_NOT_FOUND", async () => {
  const service = {
    updateChildDisplayName: async () => null,
  } as unknown as ChildApplicationService;
  const controller = new ChildController(service);

  for (const [familyId, childId] of [
    ["unknown-family", "unknown-child"],
    ["inaccessible-family", "inaccessible-child"],
    ["family-1", "missing-child"],
    ["family-2", "child-from-family-1"],
  ] as const) {
    await assert.rejects(
      () =>
        controller.updateChildDisplayName(
          familyId,
          childId,
          {
            displayName: "Yeni Etiket",
          },
          principal,
        ),
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

test("maps mutation validation failures without echoing Child data", async () => {
  const service = {
    updateChildDisplayName: async () => {
      throw new ChildMutationValidationError("UNKNOWN_FIELD");
    },
  } as unknown as ChildApplicationService;
  const controller = new ChildController(service);

  await assert.rejects(
    () =>
      controller.updateChildDisplayName(
        "family-1",
        "child-1",
        {
          displayName: "Private Label",
          familyId: "family-2",
        },
        principal,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.deepEqual(error.getResponse(), {
        statusCode: 400,
        code: "UNKNOWN_FIELD",
        message: "Invalid child display name update request.",
      });
      assert.doesNotMatch(
        JSON.stringify(error.getResponse()),
        /Private Label|family-2/,
      );
      return true;
    },
  );
});
