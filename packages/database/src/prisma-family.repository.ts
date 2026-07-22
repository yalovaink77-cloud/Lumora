import type {
  AcceptFamilyInvitationPersistenceInput,
  AcceptFamilyInvitationRepositoryResult,
  CreatedFamily,
  CreateFamilyInvitationPersistenceInput,
  CreateFamilyInvitationRepositoryResult,
  CreateFamilyPersistenceInput,
  Family,
  FamilyInvitation,
  FamilyMembership,
  FamilyRepositoryWithInvitations,
} from "@lumora/family";
import { Prisma } from "@prisma/client";

import { getPrismaClient } from "./prisma-client";

const MAX_SERIALIZABLE_ATTEMPTS = 3;
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

class InvitationClaimFailedError extends Error {}

type FamilyRecord = {
  id: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

type InvitationRecord = {
  id: string;
  familyId: string;
  inviterMembershipId: string;
  targetEmailNormalized: string;
  role: "OWNER" | "MEMBER";
  expiresAt: Date;
  consumedAt: Date | null;
  acceptedByUserId: string | null;
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

function toInvitation(record: InvitationRecord): FamilyInvitation {
  return {
    id: record.id,
    familyId: record.familyId,
    role: "MEMBER",
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

function toMembership(record: FamilyMembership): FamilyMembership {
  return {
    id: record.id,
    familyId: record.familyId,
    userId: record.userId,
    role: record.role,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isRetryableTransactionError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === "P2034" || error.code === "P2002") {
    return true;
  }

  // $queryRaw surfaces PostgreSQL serialization failures as P2010 with SQLSTATE
  // 40001 instead of Prisma's interactive-transaction code P2034.
  return (
    error.code === "P2010" &&
    (error.message.includes("40001") ||
      error.message.includes("could not serialize access"))
  );
}

export class PrismaFamilyRepository implements FamilyRepositoryWithInvitations {
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

  async createMemberInvitation(
    input: CreateFamilyInvitationPersistenceInput,
  ): Promise<CreateFamilyInvitationRepositoryResult> {
    const secretHash = Buffer.from(input.secretDigest);

    for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        return await getPrismaClient().$transaction(
          async (transaction) => {
            const inviterMembership =
              await transaction.familyMembership.findFirst({
                where: {
                  familyId: input.familyId,
                  userId: input.inviterUserId,
                  role: "OWNER",
                },
                select: { id: true },
              });

            if (!inviterMembership) {
              return { status: "FAMILY_NOT_FOUND" };
            }

            const [{ now }] = await transaction.$queryRaw<
              [{ now: Date }]
            >`SELECT CURRENT_TIMESTAMP(3) AS "now"`;
            const pending = await transaction.familyInvitation.findFirst({
              where: {
                familyId: input.familyId,
                targetEmailNormalized: input.targetEmailNormalized,
                consumedAt: null,
                expiresAt: { gt: now },
              },
              select: { id: true },
            });

            if (pending) {
              return { status: "INVITATION_ALREADY_PENDING" };
            }

            const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);
            const invitation = await transaction.familyInvitation.create({
              data: {
                familyId: input.familyId,
                inviterMembershipId: inviterMembership.id,
                targetEmailNormalized: input.targetEmailNormalized,
                role: "MEMBER",
                secretHash,
                createdAt: now,
                expiresAt,
              },
            });

            return {
              status: "CREATED",
              invitation: toInvitation(invitation),
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!isRetryableTransactionError(error)) {
          throw error;
        }
        if (attempt === MAX_SERIALIZABLE_ATTEMPTS) {
          return { status: "INVITATION_ALREADY_PENDING" };
        }
      }
    }

    return { status: "INVITATION_ALREADY_PENDING" };
  }

  async acceptMemberInvitation(
    input: AcceptFamilyInvitationPersistenceInput,
  ): Promise<AcceptFamilyInvitationRepositoryResult> {
    const secretHash = Buffer.from(input.secretDigest);

    if (secretHash.byteLength !== 32) {
      return { status: "INVITATION_NOT_FOUND" };
    }

    for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        return await getPrismaClient().$transaction(
          async (transaction) => {
            const invitations = await transaction.$queryRaw<InvitationRecord[]>`
              SELECT
                "id",
                "familyId",
                "inviterMembershipId",
                "targetEmailNormalized",
                "role",
                "expiresAt",
                "consumedAt",
                "acceptedByUserId",
                "createdAt",
                "updatedAt"
              FROM "family_invitation"
              WHERE "secretHash" = ${secretHash}
              FOR UPDATE
            `;
            const invitation = invitations[0];

            if (!invitation) {
              return { status: "INVITATION_NOT_FOUND" };
            }

            if (invitation.consumedAt) {
              if (invitation.acceptedByUserId !== input.userId) {
                return { status: "INVITATION_NOT_FOUND" };
              }

              const replay = await this.resolveAcceptedMembership(
                transaction,
                invitation.familyId,
                input.userId,
              );
              return replay ?? { status: "INVITATION_NOT_FOUND" };
            }

            const [{ now }] = await transaction.$queryRaw<
              [{ now: Date }]
            >`SELECT CURRENT_TIMESTAMP(3) AS "now"`;

            if (
              invitation.role !== "MEMBER" ||
              invitation.expiresAt.getTime() <= now.getTime() ||
              invitation.targetEmailNormalized !== input.canonicalEmail
            ) {
              return { status: "INVITATION_NOT_FOUND" };
            }

            const inviterMembership =
              await transaction.familyMembership.findUnique({
                where: {
                  id_familyId: {
                    id: invitation.inviterMembershipId,
                    familyId: invitation.familyId,
                  },
                  role: "OWNER",
                },
                select: { id: true },
              });

            if (!inviterMembership) {
              return { status: "INVITATION_NOT_FOUND" };
            }

            let membership = await transaction.familyMembership.findUnique({
              where: {
                familyId_userId: {
                  familyId: invitation.familyId,
                  userId: input.userId,
                },
              },
            });

            membership ??= await transaction.familyMembership.create({
              data: {
                familyId: invitation.familyId,
                userId: input.userId,
                role: "MEMBER",
              },
            });

            const claim = await transaction.familyInvitation.updateMany({
              where: {
                id: invitation.id,
                consumedAt: null,
                acceptedByUserId: null,
              },
              data: {
                consumedAt: now,
                acceptedByUserId: input.userId,
              },
            });

            if (claim.count !== 1) {
              throw new InvitationClaimFailedError();
            }

            const family = await transaction.family.findUnique({
              where: { id: invitation.familyId },
            });

            if (!family) {
              throw new InvitationClaimFailedError();
            }

            return {
              status: "ACCEPTED",
              family: toFamily(family),
              membership: toMembership(membership),
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          !(error instanceof InvitationClaimFailedError) &&
          !isRetryableTransactionError(error)
        ) {
          throw error;
        }
        if (attempt === MAX_SERIALIZABLE_ATTEMPTS) {
          return { status: "INVITATION_NOT_FOUND" };
        }
      }
    }

    return { status: "INVITATION_NOT_FOUND" };
  }

  private async resolveAcceptedMembership(
    transaction: Prisma.TransactionClient,
    familyId: string,
    userId: string,
  ): Promise<AcceptFamilyInvitationRepositoryResult | null> {
    const membership = await transaction.familyMembership.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    const family = await transaction.family.findUnique({
      where: { id: familyId },
    });

    if (!membership || !family) {
      return null;
    }

    return {
      status: "ACCEPTED",
      family: toFamily(family),
      membership: toMembership(membership),
    };
  }
}
