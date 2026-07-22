import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  FamilyInvitationAcceptanceValidationError,
  type FamilyApplicationService,
  VerifiedEmailRequiredError,
} from "@lumora/family";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedPrincipal } from "../auth/auth.types";
import { FamilyInvitationController } from "./family-invitation.controller";

const now = new Date("2026-07-22T12:00:00.000Z");
const principal: AuthenticatedPrincipal = {
  id: "user-1",
  email: "member@example.test",
  emailVerified: true,
  name: "Member",
};

test("acceptance exposes only the exact guarded POST route with HTTP 200", () => {
  assert.equal(
    Reflect.getMetadata(PATH_METADATA, FamilyInvitationController),
    "family-invitations",
  );
  assert.equal(
    Reflect.getMetadata(
      PATH_METADATA,
      FamilyInvitationController.prototype.acceptMemberInvitation,
    ),
    "accept",
  );
  assert.equal(
    Reflect.getMetadata(
      HTTP_CODE_METADATA,
      FamilyInvitationController.prototype.acceptMemberInvitation,
    ),
    200,
  );
  assert.deepEqual(
    Reflect.getMetadata(GUARDS_METADATA, FamilyInvitationController),
    [AuthGuard],
  );
});

test("acceptance passes only freshly mapped neutral identity and returns approved shape", async () => {
  let receivedIdentity: unknown;
  let receivedInput: unknown;
  const service = {
    acceptMemberInvitation: async (identity: unknown, input: unknown) => {
      receivedIdentity = identity;
      receivedInput = input;
      return {
        status: "ACCEPTED" as const,
        family: {
          id: "family-1",
          displayName: "Family",
          createdAt: now,
          updatedAt: now,
        },
        membership: {
          id: "membership-1",
          familyId: "family-1",
          userId: "user-1",
          role: "MEMBER" as const,
          createdAt: now,
          updatedAt: now,
        },
      };
    },
  } as unknown as FamilyApplicationService;
  const controller = new FamilyInvitationController(service);

  const response = await controller.acceptMemberInvitation(
    { invitationSecret: "s".repeat(43) },
    { ...principal, role: "OWNER" } as AuthenticatedPrincipal,
  );

  assert.deepEqual(receivedIdentity, {
    id: "user-1",
    email: "member@example.test",
    emailVerified: true,
  });
  assert.notEqual(receivedIdentity, principal);
  assert.deepEqual(receivedInput, { invitationSecret: "s".repeat(43) });
  assert.deepEqual(response, {
    family: {
      id: "family-1",
      displayName: "Family",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    membership: {
      id: "membership-1",
      familyId: "family-1",
      userId: "user-1",
      role: "MEMBER",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  });
  assert.doesNotMatch(
    JSON.stringify(response),
    /member@example|invitationSecret|emailVerified/,
  );
});

test("acceptance maps validation and verification errors without private input", async () => {
  for (const scenario of [
    {
      error: new FamilyInvitationAcceptanceValidationError("UNKNOWN_FIELD"),
      exception: BadRequestException,
      response: {
        statusCode: 400,
        code: "UNKNOWN_FIELD",
        message: "Invalid Family invitation acceptance request.",
      },
    },
    {
      error: new VerifiedEmailRequiredError(),
      exception: ForbiddenException,
      response: {
        statusCode: 403,
        code: "VERIFIED_EMAIL_REQUIRED",
        message: "Verified email is required.",
      },
    },
  ] as const) {
    const controller = new FamilyInvitationController({
      acceptMemberInvitation: async () => {
        throw scenario.error;
      },
    } as unknown as FamilyApplicationService);

    await assert.rejects(
      () =>
        controller.acceptMemberInvitation(
          {
            invitationSecret: "private-secret",
            familyId: "forbidden-family",
            userId: "forbidden-user",
            email: "private@example.test",
            role: "OWNER",
          },
          principal,
        ),
      (error: unknown) => {
        assert.ok(error instanceof scenario.exception);
        assert.deepEqual(error.getResponse(), scenario.response);
        assert.doesNotMatch(
          JSON.stringify(error.getResponse()),
          /private|forbidden|OWNER/,
        );
        return true;
      },
    );
  }
});

test("every unavailable acceptance maps to one neutral not-found response", async () => {
  const controller = new FamilyInvitationController({
    acceptMemberInvitation: async () => ({
      status: "INVITATION_NOT_FOUND",
    }),
  } as unknown as FamilyApplicationService);

  await assert.rejects(
    () =>
      controller.acceptMemberInvitation(
        { invitationSecret: "x".repeat(43) },
        principal,
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual(error.getResponse(), {
        statusCode: 404,
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found.",
      });
      return true;
    },
  );
});
