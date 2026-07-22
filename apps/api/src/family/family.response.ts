import type {
  AcceptedFamilyInvitation,
  CreatedFamily,
  CreateFamilyInvitationResult,
  Family,
  FamilyInvitation,
  FamilyMembership,
  FamilyMembershipRole,
} from "@lumora/family";

export type FamilyResponse = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type FamilyMembershipResponse = {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyMembershipRole;
  createdAt: string;
  updatedAt: string;
};

export type CreatedFamilyResponse = {
  family: FamilyResponse;
  membership: FamilyMembershipResponse;
};

export type FamilyInvitationResponse = {
  id: string;
  familyId: string;
  role: "MEMBER";
  expiresAt: string;
  createdAt: string;
};

export type CreatedFamilyInvitationResponse = {
  invitation: FamilyInvitationResponse;
  invitationSecret: string;
};

export type AcceptedFamilyInvitationResponse = {
  family: FamilyResponse;
  membership: FamilyMembershipResponse;
};

export function toFamilyResponse(family: Family): FamilyResponse {
  return {
    id: family.id,
    displayName: family.displayName,
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
  };
}

export function toFamilyMembershipResponse(
  membership: FamilyMembership,
): FamilyMembershipResponse {
  return {
    id: membership.id,
    familyId: membership.familyId,
    userId: membership.userId,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
}

export function toFamilyInvitationResponse(
  invitation: FamilyInvitation,
): FamilyInvitationResponse {
  return {
    id: invitation.id,
    familyId: invitation.familyId,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

export function toCreatedFamilyResponse(
  created: CreatedFamily,
): CreatedFamilyResponse {
  return {
    family: toFamilyResponse(created.family),
    membership: toFamilyMembershipResponse(created.membership),
  };
}

export function toCreatedFamilyInvitationResponse(
  created: Extract<CreateFamilyInvitationResult, { status: "CREATED" }>,
): CreatedFamilyInvitationResponse {
  return {
    invitation: toFamilyInvitationResponse(created.invitation),
    invitationSecret: created.invitationSecret,
  };
}

export function toAcceptedFamilyInvitationResponse(
  accepted: AcceptedFamilyInvitation,
): AcceptedFamilyInvitationResponse {
  return {
    family: toFamilyResponse(accepted.family),
    membership: toFamilyMembershipResponse(accepted.membership),
  };
}
