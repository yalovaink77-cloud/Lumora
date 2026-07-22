import {
  FAMILY_MEMBER_ROLE,
  FAMILY_OWNER_ROLE,
  type AcceptFamilyInvitationResult,
  type AuthenticatedEmailIdentity,
  type CreatedFamily,
  type CreateFamilyInvitationResult,
  type EmailIdentityPort,
  type Family,
  type FamilyInvitationRepository,
  type FamilyRepository,
  type FamilyRepositoryWithInvitations,
  type InvitationSecretDigest,
  type InvitationSecretPort,
} from "./family.types";
import {
  FAMILY_INVITATION_SECRET_PATTERN,
  FamilyInvitationCreationValidationError,
  VerifiedEmailRequiredError,
  parseAcceptFamilyInvitationInput,
  parseCreateFamilyInvitationInput,
} from "./family-invitation-validation";
import { parseCreateFamilyInput } from "./family-validation";

function assertIdentifier(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
}

export class FamilyApplicationService {
  private readonly invitationRepository?: FamilyInvitationRepository;

  constructor(repository: FamilyRepository);
  constructor(
    repository: FamilyRepositoryWithInvitations,
    emailIdentity: EmailIdentityPort,
    invitationSecrets: InvitationSecretPort,
  );
  constructor(
    private readonly repository: FamilyRepository,
    private readonly emailIdentity?: EmailIdentityPort,
    private readonly invitationSecrets?: InvitationSecretPort,
  ) {
    if (
      "createMemberInvitation" in repository &&
      typeof repository.createMemberInvitation === "function" &&
      "acceptMemberInvitation" in repository &&
      typeof repository.acceptMemberInvitation === "function"
    ) {
      this.invitationRepository = repository as FamilyRepositoryWithInvitations;
    }
  }

  async createFamily(userId: string, input: unknown): Promise<CreatedFamily> {
    assertIdentifier(userId, "userId");
    const parsedInput = parseCreateFamilyInput(input);

    return this.repository.createFamilyWithMembership({
      displayName: parsedInput.displayName,
      role: FAMILY_OWNER_ROLE,
      userId,
    });
  }

  async listFamilies(userId: string): Promise<Family[]> {
    assertIdentifier(userId, "userId");
    return this.repository.findFamiliesForUser(userId);
  }

  async getFamily(familyId: string, userId: string): Promise<Family | null> {
    assertIdentifier(familyId, "familyId");
    assertIdentifier(userId, "userId");
    return this.repository.findFamilyForUser(familyId, userId);
  }

  async createMemberInvitation(
    userId: string,
    familyId: string,
    input: unknown,
  ): Promise<CreateFamilyInvitationResult> {
    const parsedInput = parseCreateFamilyInvitationInput(input);
    assertIdentifier(userId, "userId");

    if (familyId.trim().length === 0) {
      return { status: "FAMILY_NOT_FOUND" };
    }

    const emailIdentity = this.requireEmailIdentity();
    const invitationSecrets = this.requireInvitationSecrets();
    const targetEmailNormalized = emailIdentity.canonicalizeEmail(
      parsedInput.email,
    );

    if (targetEmailNormalized === null) {
      throw new FamilyInvitationCreationValidationError("EMAIL_INVALID");
    }

    const invitationSecret = await invitationSecrets.generateSecret();

    if (!FAMILY_INVITATION_SECRET_PATTERN.test(invitationSecret)) {
      throw new Error(
        "InvitationSecretPort generated an invalid invitation secret.",
      );
    }

    const secretDigest = await invitationSecrets.digestSecret(invitationSecret);
    this.assertSecretDigest(secretDigest);

    const result =
      await this.requireInvitationRepository().createMemberInvitation({
        familyId,
        inviterUserId: userId,
        targetEmailNormalized,
        role: FAMILY_MEMBER_ROLE,
        secretDigest,
      });

    if (result.status !== "CREATED") {
      return result;
    }

    return {
      ...result,
      invitationSecret,
    };
  }

  async acceptMemberInvitation(
    identity: AuthenticatedEmailIdentity,
    input: unknown,
  ): Promise<AcceptFamilyInvitationResult> {
    const parsedInput = parseAcceptFamilyInvitationInput(input);

    if (!identity.emailVerified) {
      throw new VerifiedEmailRequiredError();
    }

    assertIdentifier(identity.id, "userId");
    assertIdentifier(identity.email, "email");

    const invitationSecrets = this.requireInvitationSecrets();
    const secretDigest = await invitationSecrets.digestSecret(
      parsedInput.invitationSecret,
    );
    this.assertSecretDigest(secretDigest);

    return this.requireInvitationRepository().acceptMemberInvitation({
      userId: identity.id,
      canonicalEmail: identity.email,
      secretDigest,
    });
  }

  private requireEmailIdentity(): EmailIdentityPort {
    if (this.emailIdentity === undefined) {
      throw new Error("EmailIdentityPort is required for Family invitations.");
    }

    return this.emailIdentity;
  }

  private requireInvitationSecrets(): InvitationSecretPort {
    if (this.invitationSecrets === undefined) {
      throw new Error(
        "InvitationSecretPort is required for Family invitations.",
      );
    }

    return this.invitationSecrets;
  }

  private requireInvitationRepository(): FamilyInvitationRepository {
    if (this.invitationRepository === undefined) {
      throw new Error(
        "FamilyInvitationRepository is required for Family invitations.",
      );
    }

    return this.invitationRepository;
  }

  private assertSecretDigest(
    digest: Uint8Array,
  ): asserts digest is InvitationSecretDigest {
    if (digest.byteLength !== 32) {
      throw new Error(
        "InvitationSecretPort produced an invalid invitation secret digest.",
      );
    }
  }
}
