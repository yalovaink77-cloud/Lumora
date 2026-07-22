import type {
  Child,
  ChildRepository,
  CreateChildPersistenceInput,
  UpdateChildDisplayNamePersistenceInput,
} from "@lumora/child";

import { getPrismaClient } from "./prisma-client";

type ChildRecord = {
  id: string;
  familyId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

const MAX_SERIALIZABLE_WRITE_ATTEMPTS = 3;

function toChild(record: ChildRecord): Child {
  return {
    id: record.id,
    familyId: record.familyId,
    displayName: record.displayName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isSerializableWriteConflict(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2034"
  );
}

async function retrySerializableWrite<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= MAX_SERIALIZABLE_WRITE_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (
        !isSerializableWriteConflict(error) ||
        attempt === MAX_SERIALIZABLE_WRITE_ATTEMPTS
      ) {
        throw error;
      }
    }
  }

  throw new Error("Serializable Child write retry limit was exhausted.");
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

  async updateChildDisplayNameForMember(
    input: UpdateChildDisplayNamePersistenceInput,
  ): Promise<Child | null> {
    return retrySerializableWrite(() =>
      getPrismaClient().$transaction(
        async (transaction) => {
          const child = await transaction.child.findFirst({
            where: {
              id: input.childId,
              familyId: input.familyId,
              family: {
                memberships: {
                  some: {
                    userId: input.userId,
                  },
                },
              },
            },
            select: {
              id: true,
            },
          });

          if (!child) {
            return null;
          }

          const updatedChild = await transaction.child.update({
            where: {
              id: child.id,
            },
            data: {
              displayName: input.displayName,
            },
          });

          return toChild(updatedChild);
        },
        {
          isolationLevel: "Serializable",
        },
      ),
    );
  }
}
