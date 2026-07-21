import type {
  CreatePregnancyPersistenceInput,
  Pregnancy,
  PregnancyRepository,
} from "@lumora/pregnancy";

import { getPrismaClient } from "./prisma-client";

type PregnancyRecord = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

function toPregnancy(record: PregnancyRecord): Pregnancy {
  return {
    id: record.id,
    familyId: record.familyId,
    displayName: record.displayName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaPregnancyRepository implements PregnancyRepository {
  async createPregnancyForMember(
    input: CreatePregnancyPersistenceInput,
  ): Promise<Pregnancy | null> {
    return getPrismaClient().$transaction(
      async (transaction) => {
        const membership = await transaction.familyMembership.findUnique({
          where: {
            familyId_userId: {
              familyId: input.familyId,
              userId: input.userId,
            },
          },
          select: {
            id: true,
          },
        });

        if (!membership) {
          return null;
        }

        const pregnancy = await transaction.pregnancy.create({
          data: {
            familyId: input.familyId,
            displayName: input.displayName,
          },
        });

        return toPregnancy(pregnancy);
      },
      {
        isolationLevel: "Serializable",
      },
    );
  }

  async findPregnanciesForMember(
    familyId: string,
    userId: string,
  ): Promise<Pregnancy[] | null> {
    const family = await getPrismaClient().family.findFirst({
      where: {
        id: familyId,
        memberships: {
          some: {
            userId,
          },
        },
      },
      select: {
        pregnancies: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    return family ? family.pregnancies.map(toPregnancy) : null;
  }

  async findPregnancyForMember(
    familyId: string,
    pregnancyId: string,
    userId: string,
  ): Promise<Pregnancy | null> {
    const pregnancy = await getPrismaClient().pregnancy.findFirst({
      where: {
        id: pregnancyId,
        familyId,
        family: {
          memberships: {
            some: {
              userId,
            },
          },
        },
      },
    });

    return pregnancy ? toPregnancy(pregnancy) : null;
  }
}
