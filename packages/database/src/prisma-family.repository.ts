import type {
  CreatedFamily,
  CreateFamilyPersistenceInput,
  Family,
  FamilyRepository,
} from "@lumora/family";

import { getPrismaClient } from "./prisma-client";

type FamilyRecord = {
  id: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

function toFamily(record: FamilyRecord): Family {
  return {
    id: record.id,
    displayName: record.displayName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaFamilyRepository implements FamilyRepository {
  async createFamilyWithMembership(
    input: CreateFamilyPersistenceInput,
  ): Promise<CreatedFamily> {
    return getPrismaClient().$transaction(async (transaction) => {
      const family = await transaction.family.create({
        data: {
          displayName: input.displayName,
        },
      });
      const membership = await transaction.familyMembership.create({
        data: {
          familyId: family.id,
          role: input.role,
          userId: input.userId,
        },
      });

      return {
        family: toFamily(family),
        membership: {
          id: membership.id,
          familyId: membership.familyId,
          userId: membership.userId,
          role: membership.role,
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        },
      };
    });
  }

  async findFamiliesForUser(userId: string): Promise<Family[]> {
    const families = await getPrismaClient().family.findMany({
      where: {
        memberships: {
          some: {
            userId,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return families.map(toFamily);
  }

  async findFamilyForUser(
    familyId: string,
    userId: string,
  ): Promise<Family | null> {
    const family = await getPrismaClient().family.findFirst({
      where: {
        id: familyId,
        memberships: {
          some: {
            userId,
          },
        },
      },
    });

    return family ? toFamily(family) : null;
  }
}
