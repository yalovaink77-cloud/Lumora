export type Pregnancy = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePregnancyPersistenceInput = {
  familyId: string;
  userId: string;
  displayName: string;
};

export interface PregnancyRepository {
  createPregnancyForMember(
    input: CreatePregnancyPersistenceInput,
  ): Promise<Pregnancy | null>;
  findPregnanciesForMember(
    familyId: string,
    userId: string,
  ): Promise<Pregnancy[] | null>;
  findPregnancyForMember(
    familyId: string,
    pregnancyId: string,
    userId: string,
  ): Promise<Pregnancy | null>;
}
