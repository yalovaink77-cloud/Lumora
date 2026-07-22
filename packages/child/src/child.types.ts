export type Child = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateChildPersistenceInput = {
  familyId: string;
  userId: string;
  displayName: string;
};

export type UpdateChildDisplayNamePersistenceInput = {
  familyId: string;
  childId: string;
  userId: string;
  displayName: string;
};

export interface ChildRepository {
  createChildForMember(
    input: CreateChildPersistenceInput,
  ): Promise<Child | null>;
  findChildrenForMember(
    familyId: string,
    userId: string,
  ): Promise<Child[] | null>;
  findChildForMember(
    familyId: string,
    childId: string,
    userId: string,
  ): Promise<Child | null>;
  updateChildDisplayNameForMember(
    input: UpdateChildDisplayNamePersistenceInput,
  ): Promise<Child | null>;
}
