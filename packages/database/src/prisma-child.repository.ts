import type {
  Child,
  ChildRepository,
  CreateChildPersistenceInput,
} from "@lumora/child";

import { getPrismaClient } from "./prisma-client";

type ChildRecord = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

function toChild(record: ChildRecord): Child {
  return {
    id: record.id,
    familyId: record.familyId,
    displayName: record.displayName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaChildRepository implements ChildRepository {
  async createChildForMember(
    input: CreateChildPersistenceInput,
  ): Promise<Child | null> {
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

        const child = await transaction.child.create({
          data: {
            familyId: input.familyId,
            displayName: input.displayName,
          },
        });

        return toChild(child);
      },
      {
        isolationLevel: "Serializable",
      },
    );
  }

  async findChildrenForMember(
    familyId: string,
    userId: string,
  ): Promise<Child[] | null> {
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
        children: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    return family ? family.children.map(toChild) : null;
  }

  async findChildForMember(
    familyId: string,
    childId: string,
    userId: string,
  ): Promise<Child | null> {
    const child = await getPrismaClient().child.findFirst({
      where: {
        id: childId,
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

    return child ? toChild(child) : null;
  }
}
