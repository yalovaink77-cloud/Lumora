-- Lumora minimum Child foundation.

-- CreateTable
CREATE TABLE "child" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "child_familyId_idx" ON "child"("familyId");

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
