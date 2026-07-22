import assert from "node:assert/strict";
import { test } from "node:test";

import { FamilyApplicationService } from "./family-application.service";
import {
  FAMILY_MEMBER_ROLE,
  type AcceptFamilyInvitationPersistenceInput,
  type AcceptFamilyInvitationRepositoryResult,
  type CreateFamilyInvitationPersistenceInput,
  type CreateFamilyInvitationRepositoryResult,
  type EmailIdentityPort,
  type Family,
  type FamilyRepository,
  type InvitationSecretDigest,
  type InvitationSecretPort,
} from "./family.types";
import {
  FamilyInvitationAcceptanceValidationError,
  FamilyInvitationCreationValidationError,
  VerifiedEmailRequiredError,
} from "./family-invitation-validation";

const rawSecret = "Ab_-09".repeat(7) + "A";
const digest = new Uint8Array(32) as InvitationSecretDigest;
const now = new Date("2026-07-22T12:00:00.000Z");

class RecordingRepository implements FamilyRepository {
  readonly creationInputs: CreateFamilyInvitationPersistenceInput[] = [];
  readonly acceptanceInputs: AcceptFamilyInvitationPersistenceInput[] = [];
  creationResult: CreateFamilyInvitationRepositoryResult = {
    status: "CREATED",
    invitation: {
      id: "invitation-1",
      familyId: "family-1",
      role: FAMILY_MEMBER_ROLE,
      expiresAt: new Date("2026-07-29T12:00:00.000Z"),
      createdAt: now,
    },
  };
  acceptanceResult: AcceptFamilyInvitationRepositoryResult = {
    status: "INVITATION_NOT_FOUND",
  };

  async createFamilyWithMembership(): Promise<never> {
    throw new Error("Not used.");
  }

  async findFamiliesForUser(): Promise<Family[]> {
    return [];
  }

  async findFamilyForUser(): Promise<Family | null> {
    return null;
  }

  async createMemberInvitation(input: CreateFamilyInvitationPersistenceInput) {
    this.creationInputs.push(input);
    return this.creationResult;
  }

  async acceptMemberInvitation(input: AcceptFamilyInvitationPersistenceInput) {
    this.acceptanceInputs.push(input);
    return this.acceptanceResult;
  }
}

class RecordingEmailIdentity implements EmailIdentityPort {
  readonly inputs: string[] = [];
  result: string | null = "member@example.com";

  canonicalizeEmail(email: string): string | null {
    this.inputs.push(email);
    return this.result;
  }
}

class RecordingSecrets implements InvitationSecretPort {
  readonly digested: string[] = [];
  generationCount = 0;
  generatedSecret = rawSecret;

  async generateSecret(): Promise<string> {
    this.generationCount += 1;
    return this.generatedSecret;
  }

  async digestSecret(secret: string): Promise<InvitationSecretDigest> {
    this.digested.push(secret);
    return digest;
  }
}

function createService() {
  const repository = new RecordingRepository();
  const emailIdentity = new RecordingEmailIdentity();
  const secrets = new RecordingSecrets();
  const service = new FamilyApplicationService(
    repository,
    emailIdentity,
    secrets,
  );

  return { emailIdentity, repository, secrets, service };
}

test("OWNER invitation creation canonicalizes, generates, digests, and delegates", async () => {
  const { emailIdentity, repository, secrets, service } = createService();

  const result = await service.createMemberInvitation("owner-1", "family-1", {
    email: "Member@Example.com",
  });

  assert.deepEqual(emailIdentity.inputs, ["Member@Example.com"]);
  assert.equal(secrets.generationCount, 1);
  assert.deepEqual(secrets.digested, [rawSecret]);
  assert.deepEqual(repository.creationInputs, [
    {
      familyId: "family-1",
      inviterUserId: "owner-1",
      targetEmailNormalized: "member@example.com",
      role: FAMILY_MEMBER_ROLE,
      secretDigest: digest,
    },
  ]);
  assert.equal(result.status, "CREATED");
  assert.equal(result.invitationSecret, rawSecret);
});

test("creation does not trim and maps canonicalizer rejection to EMAIL_INVALID", async () => {
  const { emailIdentity, repository, secrets, service } = createService();
  emailIdentity.result = null;

  await assert.rejects(
    () =>
      service.createMemberInvitation("owner-1", "family-1", {
        email: " member@example.com ",
      }),
    (error: unknown) =>
      error instanceof FamilyInvitationCreationValidationError &&
      error.code === "EMAIL_INVALID",
  );

  assert.deepEqual(emailIdentity.inputs, [" member@example.com "]);
  assert.equal(secrets.generationCount, 0);
  assert.deepEqual(repository.creationInputs, []);
});

test("creation rejects a generated secret outside the exact base64url shape", async () => {
  const { repository, secrets, service } = createService();
  secrets.generatedSecret = `${"A".repeat(42)}=`;

  await assert.rejects(
    () =>
      service.createMemberInvitation("owner-1", "family-1", {
        email: "member@example.com",
      }),
    /generated an invalid invitation secret/,
  );

  assert.deepEqual(secrets.digested, []);
  assert.deepEqual(repository.creationInputs, []);
});

test("duplicate invitation result never includes the newly generated secret", async () => {
  const { repository, service } = createService();
  repository.creationResult = { status: "INVITATION_ALREADY_PENDING" };

  assert.deepEqual(
    await service.createMemberInvitation("owner-1", "family-1", {
      email: "member@example.com",
    }),
    { status: "INVITATION_ALREADY_PENDING" },
  );
});

test("acceptance validates the body before the verified-email gate", async () => {
  const { repository, secrets, service } = createService();

  await assert.rejects(
    () =>
      service.acceptMemberInvitation(
        {
          id: "user-1",
          email: "member@example.com",
          emailVerified: false,
        },
        { invitationSecret: "invalid" },
      ),
    FamilyInvitationAcceptanceValidationError,
  );

  assert.deepEqual(secrets.digested, []);
  assert.deepEqual(repository.acceptanceInputs, []);
});

test("unverified acceptance is rejected before digest and repository lookup", async () => {
  const { repository, secrets, service } = createService();

  await assert.rejects(
    () =>
      service.acceptMemberInvitation(
        {
          id: "user-1",
          email: "member@example.com",
          emailVerified: false,
        },
        { invitationSecret: rawSecret },
      ),
    (error: unknown) =>
      error instanceof VerifiedEmailRequiredError &&
      error.code === "VERIFIED_EMAIL_REQUIRED" &&
      error.message === "Verified email is required.",
  );

  assert.deepEqual(secrets.digested, []);
  assert.deepEqual(repository.acceptanceInputs, []);
});

test("verified acceptance digests, delegates, and forwards success unchanged", async () => {
  const { repository, secrets, service } = createService();
  const accepted = {
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
      role: FAMILY_MEMBER_ROLE,
      createdAt: now,
      updatedAt: now,
    },
  };
  repository.acceptanceResult = accepted;

  const result = await service.acceptMemberInvitation(
    {
      id: "user-1",
      email: "member@example.com",
      emailVerified: true,
    },
    { invitationSecret: rawSecret },
  );

  assert.deepEqual(secrets.digested, [rawSecret]);
  assert.deepEqual(repository.acceptanceInputs, [
    {
      userId: "user-1",
      canonicalEmail: "member@example.com",
      secretDigest: digest,
    },
  ]);
  assert.equal(result, accepted);
});

test("acceptance forwards unavailable result unchanged", async () => {
  const { repository, service } = createService();
  const unavailable = { status: "INVITATION_NOT_FOUND" as const };
  repository.acceptanceResult = unavailable;

  assert.equal(
    await service.acceptMemberInvitation(
      {
        id: "user-1",
        email: "member@example.com",
        emailVerified: true,
      },
      { invitationSecret: rawSecret },
    ),
    unavailable,
  );
});
