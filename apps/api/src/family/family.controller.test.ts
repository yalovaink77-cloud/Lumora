import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  RequestMethod,
} from "@nestjs/common";
import {
  FamilyInvitationCreationValidationError,
  type FamilyApplicationService,
} from "@lumora/family";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { FamilyController } from "./family.controller";

const principal: AuthenticatedPrincipal = {
  id: "authenticated-user",
  email: "user@example.test",
  emailVerified: false,
  name: "Test User",
};

const now = new Date("2026-07-21T12:00:00.000Z");

test("invitation creation exposes the exact guarded nested POST route", () => {
  assert.equal(
    Reflect.getMetadata(PATH_METADATA, FamilyController),
    "families",
  );
  assert.equal(
    Reflect.getMetadata(
      PATH_METADATA,
      FamilyController.prototype.createMemberInvitation,
    ),
    ":familyId/invitations",
  );
  assert.equal(
    Reflect.getMetadata(
      METHOD_METADATA,
      FamilyController.prototype.createMemberInvitation,
    ),
    RequestMethod.POST,
  );
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, FamilyController), [
    AuthGuard,
  ]);
});

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

test("creates an invitation with the exact private response shape", async () => {
  const service = {
    createMemberInvitation: async (
      userId: string,
      familyId: string,
      input: unknown,
    ) => {
      assert.equal(userId, principal.id);
      assert.equal(familyId, "family-1");
      assert.deepEqual(input, { email: "Member@Example.test" });
      return {
        status: "CREATED" as const,
        invitation: {
          id: "invitation-1",
          familyId,
          role: "MEMBER" as const,
          expiresAt: new Date("2026-07-28T12:00:00.000Z"),
          createdAt: now,
        },
        invitationSecret: "a".repeat(43),
      };
    },
  } as unknown as FamilyApplicationService;
  const controller = new FamilyController(service);

  const response = await controller.createMemberInvitation(
    "family-1",
    { email: "Member@Example.test" },
    principal,
  );

  assert.deepEqual(response, {
    invitation: {
      id: "invitation-1",
      familyId: "family-1",
      role: "MEMBER",
      expiresAt: "2026-07-28T12:00:00.000Z",
      createdAt: now.toISOString(),
    },
    invitationSecret: "a".repeat(43),
  });
  assert.equal(JSON.stringify(response).match(/a{43}/g)?.length, 1);
  assert.doesNotMatch(
    JSON.stringify(response),
    /Member@Example|secretDigest|targetEmail/,
  );
});

test("maps invitation creation validation before neutral domain outcomes", async () => {
  const validationController = new FamilyController({
    createMemberInvitation: async () => {
      throw new FamilyInvitationCreationValidationError("UNKNOWN_FIELD");
    },
  } as unknown as FamilyApplicationService);

  await assert.rejects(
    () =>
      validationController.createMemberInvitation(
        "family-1",
        { email: "private@example.test", role: "OWNER" },
        principal,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.deepEqual(error.getResponse(), {
        statusCode: 400,
        code: "UNKNOWN_FIELD",
        message: "Invalid Family invitation request.",
      });
      assert.doesNotMatch(
        JSON.stringify(error.getResponse()),
        /private@example/,
      );
      return true;
    },
  );

  for (const status of [
    "FAMILY_NOT_FOUND",
    "INVITATION_ALREADY_PENDING",
  ] as const) {
    const controller = new FamilyController({
      createMemberInvitation: async () => ({ status }),
    } as unknown as FamilyApplicationService);

    await assert.rejects(
      () =>
        controller.createMemberInvitation(
          "family-1",
          { email: "member@example.test" },
          principal,
        ),
      (error: unknown) => {
        if (status === "FAMILY_NOT_FOUND") {
          assert.ok(error instanceof NotFoundException);
          assert.deepEqual(error.getResponse(), {
            statusCode: 404,
            code: "FAMILY_NOT_FOUND",
            message: "Family not found.",
          });
        } else {
          assert.ok(error instanceof ConflictException);
          assert.deepEqual(error.getResponse(), {
            statusCode: 409,
            code: "INVITATION_ALREADY_PENDING",
            message: "A pending invitation already exists.",
          });
        }
        return true;
      },
    );
  }
});
