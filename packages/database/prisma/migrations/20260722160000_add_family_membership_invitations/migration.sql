-- Validate the existing Family foundation before any schema mutation.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "family_membership"
        WHERE "role"::text <> 'OWNER'
    ) THEN
        RAISE EXCEPTION 'preflight failed: existing family membership roles must all be OWNER';
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "family" AS f
        LEFT JOIN "family_membership" AS fm
          ON fm."familyId" = f."id"
         AND fm."role"::text = 'OWNER'
        GROUP BY f."id"
        HAVING COUNT(fm."id") <> 1
    ) THEN
        RAISE EXCEPTION 'preflight failed: every existing family must have exactly one OWNER';
    END IF;
END
$$;

-- Extend the approved role vocabulary.
ALTER TYPE "FamilyMembershipRole" ADD VALUE 'MEMBER';

-- PostgreSQL allows ADD VALUE in a transaction, but the new enum literal cannot
-- be referenced until that transaction commits. End Prisma's wrapping
-- transaction here so later CHECK/DDL may safely use MEMBER.
COMMIT;

-- Support the same-Family composite inviter foreign key.
CREATE UNIQUE INDEX "family_membership_id_familyId_key"
    ON "family_membership"("id", "familyId");

-- Enforce at most one OWNER membership per Family.
CREATE UNIQUE INDEX "family_membership_one_owner_per_family_idx"
    ON "family_membership"("familyId")
    WHERE "role" = 'OWNER';

-- Create the minimum invitation persistence model.
CREATE TABLE "family_invitation" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "inviterMembershipId" TEXT NOT NULL,
    "targetEmailNormalized" TEXT NOT NULL,
    "role" "FamilyMembershipRole" NOT NULL,
    "secretHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "family_invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "family_invitation_secretHash_length_check"
        CHECK (octet_length("secretHash") = 32),
    CONSTRAINT "family_invitation_role_member_check"
        CHECK ("role" = 'MEMBER'),
    CONSTRAINT "family_invitation_consumption_pair_check"
        CHECK (("consumedAt" IS NULL) = ("acceptedByUserId" IS NULL)),
    CONSTRAINT "family_invitation_expiry_check"
        CHECK ("expiresAt" > "createdAt")
);

CREATE UNIQUE INDEX "family_invitation_secretHash_key"
    ON "family_invitation"("secretHash");
CREATE INDEX "family_invitation_familyId_idx"
    ON "family_invitation"("familyId");
CREATE INDEX "family_invitation_familyId_targetEmailNormalized_consumedAt_expiresAt_idx"
    ON "family_invitation"("familyId", "targetEmailNormalized", "consumedAt", "expiresAt");
CREATE INDEX "family_invitation_inviterMembershipId_idx"
    ON "family_invitation"("inviterMembershipId");

ALTER TABLE "family_invitation"
    ADD CONSTRAINT "family_invitation_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "family"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "family_invitation"
    ADD CONSTRAINT "family_invitation_inviterMembershipId_familyId_fkey"
    FOREIGN KEY ("inviterMembershipId", "familyId")
    REFERENCES "family_membership"("id", "familyId")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "family_invitation"
    ADD CONSTRAINT "family_invitation_acceptedByUserId_fkey"
    FOREIGN KEY ("acceptedByUserId") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
