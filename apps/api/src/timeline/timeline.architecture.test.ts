import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const repositoryRoot = join(process.cwd(), "../..");
const schemaPath = join(
  repositoryRoot,
  "packages/database/prisma/schema.prisma",
);
const migrationPath = join(
  repositoryRoot,
  "packages/database/prisma/migrations/20260722143000_add_timeline_foundation/migration.sql",
);

test("@lumora/timeline remains independent of infrastructure and subjects", () => {
  const sourceDirectory = join(repositoryRoot, "packages/timeline/src");
  const productionSources = readdirSync(sourceDirectory)
    .filter(
      (fileName) => fileName.endsWith(".ts") && !fileName.endsWith(".test.ts"),
    )
    .map((fileName) => readFileSync(join(sourceDirectory, fileName), "utf8"))
    .join("\n");

  assert.doesNotMatch(productionSources, /@nestjs/);
  assert.doesNotMatch(productionSources, /better-auth/);
  assert.doesNotMatch(productionSources, /@prisma\/client/);
  assert.doesNotMatch(productionSources, /@lumora\/database/);
  assert.doesNotMatch(productionSources, /@lumora\/pregnancy/);
  assert.doesNotMatch(productionSources, /@lumora\/child/);
  assert.doesNotMatch(productionSources, /new PrismaClient\(/);
});

test("Timeline schema contains only approved fields and relationships", () => {
  const schema = readFileSync(schemaPath, "utf8");
  const model = schema.match(/model TimelineEvent \{(?<body>[\s\S]*?)\n\}/)
    ?.groups?.body;

  assert.ok(model);
  assert.match(model, /^\s*id\s+String\s+@id @default\(cuid\(\)\)$/m);
  assert.match(model, /^\s*familyId\s+String$/m);
  assert.match(model, /^\s*pregnancyId\s+String\?$/m);
  assert.match(model, /^\s*pregnancyFamilyId\s+String\?$/m);
  assert.match(model, /^\s*childId\s+String\?$/m);
  assert.match(model, /^\s*childFamilyId\s+String\?$/m);
  assert.match(model, /^\s*title\s+String\s+@db\.VarChar\(80\)$/m);
  assert.match(model, /^\s*occurredAt\s+DateTime\s+@db\.Timestamptz\(3\)$/m);
  assert.match(model, /^\s*createdAt\s+DateTime\s+@default\(now\(\)\)$/m);
  assert.match(model, /^\s*updatedAt\s+DateTime\s+@updatedAt$/m);
  assert.equal(model.match(/onDelete: Restrict/g)?.length, 3);
  assert.doesNotMatch(
    model,
    /\b(userId|membershipId|authorId|note|body|description|category|healthId|mediaId|status)\b/,
  );
});

test("Timeline migration enforces exactly-one and same-Family subjects", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /CREATE TABLE "timeline_event"/);
  assert.match(migration, /"title" VARCHAR\(80\) NOT NULL/);
  assert.match(migration, /"occurredAt" TIMESTAMPTZ\(3\) NOT NULL/);
  assert.match(
    migration,
    /CONSTRAINT "timeline_event_exactly_one_subject_check" CHECK/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("pregnancyId", "pregnancyFamilyId"\)[\s\S]*REFERENCES "pregnancy"\("id", "familyId"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("childId", "childFamilyId"\)[\s\S]*REFERENCES "child"\("id", "familyId"\)/,
  );
  assert.equal(migration.match(/ON DELETE RESTRICT/g)?.length, 3);
  assert.match(
    migration,
    /"familyId", "pregnancyId", "occurredAt" DESC, "createdAt" DESC, "id" DESC/,
  );
  assert.match(
    migration,
    /"familyId", "childId", "occurredAt" DESC, "createdAt" DESC, "id" DESC/,
  );
  assert.doesNotMatch(
    migration,
    /DROP|CASCADE|UNIQUE.*title|title.*UNIQUE|occurredAt.*UNIQUE/,
  );
});

test("Timeline creation and reads remain atomically membership scoped", () => {
  const repository = readFileSync(
    join(repositoryRoot, "packages/database/src/prisma-timeline.repository.ts"),
    "utf8",
  );

  assert.match(repository, /\.\$transaction\(/);
  assert.match(repository, /isolationLevel: "Serializable"/);
  assert.match(repository, /memberships/);
  assert.match(repository, /timelineEvent\.create/);
  assert.match(repository, /pregnancy\.findFirst/);
  assert.match(repository, /child\.findFirst/);
  assert.match(repository, /timelineEvent\.findFirst/);
  assert.match(repository, /occurredAt: "desc"/);
  assert.match(repository, /createdAt: "desc"/);
  assert.match(repository, /id: "desc"/);
  assert.doesNotMatch(repository, /timelineEvent\.(update|delete|upsert)/);
});

test("Timeline HTTP composition exposes only six approved routes", () => {
  const controller = readFileSync(
    join(repositoryRoot, "apps/api/src/timeline/timeline.controller.ts"),
    "utf8",
  );

  assert.match(
    controller,
    /families\/:familyId\/pregnancies\/:pregnancyId\/timeline-events/,
  );
  assert.match(
    controller,
    /families\/:familyId\/children\/:childId\/timeline-events/,
  );
  assert.equal(controller.match(/@Post\(\)/g)?.length, 2);
  assert.equal(controller.match(/@Get\(\)/g)?.length, 2);
  assert.equal(controller.match(/@Get\(":timelineEventId"\)/g)?.length, 2);
  assert.doesNotMatch(controller, /@Patch|@Put|@Delete/);
  assert.doesNotMatch(
    controller,
    /FAMILY_NOT_FOUND|PREGNANCY_NOT_FOUND|CHILD_NOT_FOUND/,
  );
  assert.match(controller, /TIMELINE_NOT_FOUND/);
});
