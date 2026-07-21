import type {
  CreatedFamily,
  Family,
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

export function toFamilyResponse(family: Family): FamilyResponse {
  return {
    id: family.id,
    displayName: family.displayName,
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
  };
}

function toFamilyMembershipResponse(
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

export function toCreatedFamilyResponse(
  created: CreatedFamily,
): CreatedFamilyResponse {
  return {
    family: toFamilyResponse(created.family),
    membership: toFamilyMembershipResponse(created.membership),
  };
}
