-- Lumora minimum Family and FamilyMembership foundation.

-- CreateEnum
CREATE TYPE "FamilyMembershipRole" AS ENUM ('OWNER');

-- CreateTable
CREATE TABLE "family" (
    "id" TEXT NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_membership" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FamilyMembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_membership_familyId_userId_key" ON "family_membership"("familyId", "userId");

-- CreateIndex
CREATE INDEX "family_membership_userId_idx" ON "family_membership"("userId");

-- AddForeignKey
ALTER TABLE "family_membership" ADD CONSTRAINT "family_membership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_membership" ADD CONSTRAINT "family_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
