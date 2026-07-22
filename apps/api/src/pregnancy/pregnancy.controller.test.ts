import assert from "node:assert/strict";
import { test } from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  type PregnancyApplicationService,
  PregnancyValidationError,
} from "@lumora/pregnancy";

import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { PregnancyController } from "./pregnancy.controller";

const principal: AuthenticatedPrincipal = {
  id: "authenticated-user",
  email: "user@example.test",
  emailVerified: false,
  name: "Test User",
};

const now = new Date("2026-07-21T12:00:00.000Z");

test("creates a Pregnancy from route Family scope and neutral principal only", async () => {
  let receivedFamilyId = "";
  let receivedUserId = "";
  let receivedInput: unknown;
  const service = {
    createPregnancy: async (
      familyId: string,
      userId: string,
      input: unknown,
    ) => {
      receivedFamilyId = familyId;
      receivedUserId = userId;
      receivedInput = input;

      return {
        id: "pregnancy-1",
        familyId,
        displayName: "Minik Yolculuk",
        createdAt: now,
        updatedAt: now,
      };
    },
  } as unknown as PregnancyApplicationService;
  const controller = new PregnancyController(service);

  const response = await controller.createPregnancy(
    "family-1",
    {
      displayName: "Minik Yolculuk",
    },
    principal,
  );

  assert.equal(receivedFamilyId, "family-1");
  assert.equal(receivedUserId, "authenticated-user");
  assert.deepEqual(receivedInput, {
    displayName: "Minik Yolculuk",
  });
  assert.deepEqual(response, {
    id: "pregnancy-1",
    familyId: "family-1",
    displayName: "Minik Yolculuk",
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
    listPregnancies: async () => [
      {
        id: "pregnancy-1",
        familyId: "family-1",
        displayName: "Journey",
        createdAt: now,
        updatedAt: now,
      },
    ],
  } as unknown as PregnancyApplicationService;
  const controller = new PregnancyController(service);

  assert.deepEqual(await controller.listPregnancies("family-1", principal), {
    pregnancies: [
      {
        id: "pregnancy-1",
        familyId: "family-1",
        displayName: "Journey",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ],
  });
});

test("maps all unavailable Family outcomes to one not-found response", async () => {
  const service = {
    createPregnancy: async () => null,
    listPregnancies: async () => null,
  } as unknown as PregnancyApplicationService;
  const controller = new PregnancyController(service);
  const expectedResponse = {
    statusCode: 404,
    code: "FAMILY_NOT_FOUND",
    message: "Family not found.",
  };

  await assert.rejects(
    () =>
      controller.createPregnancy(
        "unavailable-family",
        {
          displayName: "Journey",
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
    () => controller.listPregnancies("unavailable-family", principal),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual(error.getResponse(), expectedResponse);
      return true;
    },
  );
});

test("maps every unavailable scoped Pregnancy to one not-found response", async () => {
  const service = {
    getPregnancy: async () => null,
  } as unknown as PregnancyApplicationService;
  const controller = new PregnancyController(service);

  for (const [familyId, pregnancyId] of [
    ["family-1", "unknown-pregnancy"],
    ["inaccessible-family", "inaccessible-pregnancy"],
    ["family-1", "pregnancy-from-family-2"],
  ] as const) {
    await assert.rejects(
      () => controller.getPregnancy(familyId, pregnancyId, principal),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.deepEqual(error.getResponse(), {
          statusCode: 404,
          code: "PREGNANCY_NOT_FOUND",
          message: "Pregnancy not found.",
        });
        return true;
      },
    );
  }
});

test("maps Pregnancy validation failures to safe HTTP 400 responses", async () => {
  const service = {
    createPregnancy: async () => {
      throw new PregnancyValidationError("UNKNOWN_FIELD");
    },
  } as unknown as PregnancyApplicationService;
  const controller = new PregnancyController(service);

  await assert.rejects(
    () =>
      controller.createPregnancy(
        "family-1",
        {
          displayName: "Journey",
          userId: "client-user",
        },
        principal,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.deepEqual(error.getResponse(), {
        statusCode: 400,
        code: "UNKNOWN_FIELD",
        message: "Invalid pregnancy creation request.",
      });
      return true;
    },
  );
});
