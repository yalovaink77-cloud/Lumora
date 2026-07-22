export const FAMILY_OWNER_ROLE = "OWNER" as const;
export const FAMILY_MEMBER_ROLE = "MEMBER" as const;

export const FAMILY_MEMBERSHIP_ROLES = [
  FAMILY_OWNER_ROLE,
  FAMILY_MEMBER_ROLE,
] as const;

export type FamilyMembershipRole = (typeof FAMILY_MEMBERSHIP_ROLES)[number];

export type Family = {
  id: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FamilyMembership = {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyMembershipRole;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatedFamily = {
  family: Family;
  membership: FamilyMembership;
};

export type CreateFamilyPersistenceInput = {
  displayName: string;
  userId: string;
  role: typeof FAMILY_OWNER_ROLE;
};

export type FamilyInvitation = {
  id: string;
  familyId: string;
  role: typeof FAMILY_MEMBER_ROLE;
  expiresAt: Date;
  createdAt: Date;
};

export type AuthenticatedEmailIdentity = {
  id: string;
  email: string;
  emailVerified: boolean;
};

export interface EmailIdentityPort {
  canonicalizeEmail(email: string): string | null;
}

declare const invitationSecretDigestBrand: unique symbol;

export type InvitationSecretDigest = Uint8Array & {
  readonly [invitationSecretDigestBrand]: true;
};

export interface InvitationSecretPort {
  generateSecret(): Promise<string>;
  digestSecret(secret: string): Promise<InvitationSecretDigest>;
}

export type CreateFamilyInvitationPersistenceInput = {
  familyId: string;
  inviterUserId: string;
  targetEmailNormalized: string;
  role: typeof FAMILY_MEMBER_ROLE;
  secretDigest: InvitationSecretDigest;
};

export type CreateFamilyInvitationRepositoryResult =
  | {
      status: "CREATED";
      invitation: FamilyInvitation;
    }
  | {
      status: "FAMILY_NOT_FOUND";
    }
  | {
      status: "INVITATION_ALREADY_PENDING";
    };

export type CreateFamilyInvitationResult =
  | {
      status: "CREATED";
      invitation: FamilyInvitation;
      invitationSecret: string;
    }
  | {
      status: "FAMILY_NOT_FOUND";
    }
  | {
      status: "INVITATION_ALREADY_PENDING";
    };

export type AcceptFamilyInvitationPersistenceInput = {
  userId: string;
  canonicalEmail: string;
  secretDigest: InvitationSecretDigest;
};

export type AcceptedFamilyInvitation = {
  family: Family;
  membership: FamilyMembership;
};

export type AcceptFamilyInvitationRepositoryResult =
  | ({
      status: "ACCEPTED";
    } & AcceptedFamilyInvitation)
  | {
      status: "INVITATION_NOT_FOUND";
    };

export type AcceptFamilyInvitationResult =
  AcceptFamilyInvitationRepositoryResult;

export interface FamilyRepository {
  createFamilyWithMembership(
    input: CreateFamilyPersistenceInput,
  ): Promise<CreatedFamily>;
  findFamiliesForUser(userId: string): Promise<Family[]>;
  findFamilyForUser(familyId: string, userId: string): Promise<Family | null>;
}

export interface FamilyInvitationRepository {
  createMemberInvitation(
    input: CreateFamilyInvitationPersistenceInput,
  ): Promise<CreateFamilyInvitationRepositoryResult>;
  acceptMemberInvitation(
    input: AcceptFamilyInvitationPersistenceInput,
  ): Promise<AcceptFamilyInvitationRepositoryResult>;
}

export type FamilyRepositoryWithInvitations = FamilyRepository &
  FamilyInvitationRepository;
