export const FAMILY_OWNER_ROLE = "OWNER" as const;

export type FamilyMembershipRole = typeof FAMILY_OWNER_ROLE;

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
  role: FamilyMembershipRole;
};

export interface FamilyRepository {
  createFamilyWithMembership(
    input: CreateFamilyPersistenceInput,
  ): Promise<CreatedFamily>;
  findFamiliesForUser(userId: string): Promise<Family[]>;
  findFamilyForUser(familyId: string, userId: string): Promise<Family | null>;
}
