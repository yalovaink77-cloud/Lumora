-- Lumora minimum Timeline foundation.

-- Add relational candidate keys required by same-Family composite references.
CREATE UNIQUE INDEX "pregnancy_id_familyId_key" ON "pregnancy"("id", "familyId");
CREATE UNIQUE INDEX "child_id_familyId_key" ON "child"("id", "familyId");

-- CreateTable
CREATE TABLE "timeline_event" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "pregnancyId" TEXT,
    "pregnancyFamilyId" TEXT,
    "childId" TEXT,
    "childFamilyId" TEXT,
    "title" VARCHAR(80) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "timeline_event_exactly_one_subject_check" CHECK (
        (
            "pregnancyId" IS NOT NULL
            AND "pregnancyFamilyId" IS NOT NULL
            AND "pregnancyFamilyId" = "familyId"
            AND "childId" IS NULL
            AND "childFamilyId" IS NULL
        )
        OR
        (
            "childId" IS NOT NULL
            AND "childFamilyId" IS NOT NULL
            AND "childFamilyId" = "familyId"
            AND "pregnancyId" IS NULL
            AND "pregnancyFamilyId" IS NULL
        )
    )
);

-- CreateIndex
CREATE INDEX "timeline_event_familyId_pregnancyId_occurredAt_createdAt_id_idx"
ON "timeline_event"("familyId", "pregnancyId", "occurredAt" DESC, "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "timeline_event_familyId_childId_occurredAt_createdAt_id_idx"
ON "timeline_event"("familyId", "childId", "occurredAt" DESC, "createdAt" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "timeline_event"
ADD CONSTRAINT "timeline_event_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "family"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "timeline_event"
ADD CONSTRAINT "timeline_event_pregnancyId_pregnancyFamilyId_fkey"
FOREIGN KEY ("pregnancyId", "pregnancyFamilyId")
REFERENCES "pregnancy"("id", "familyId")
ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "timeline_event"
ADD CONSTRAINT "timeline_event_childId_childFamilyId_fkey"
FOREIGN KEY ("childId", "childFamilyId")
REFERENCES "child"("id", "familyId")
ON DELETE RESTRICT ON UPDATE RESTRICT;
