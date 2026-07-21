-- Lumora minimum Pregnancy foundation.

-- CreateTable
CREATE TABLE "pregnancy" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pregnancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pregnancy_familyId_idx" ON "pregnancy"("familyId");

-- AddForeignKey
ALTER TABLE "pregnancy" ADD CONSTRAINT "pregnancy_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
