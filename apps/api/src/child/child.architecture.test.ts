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
  "packages/database/prisma/migrations/20260722123000_add_child_foundation/migration.sql",
);

test("@lumora/child remains independent of application and infrastructure", () => {
  const sourceDirectory = join(repositoryRoot, "packages/child/src");
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
  assert.doesNotMatch(productionSources, /new PrismaClient\(/);
});

test("Child persistence contains only approved fields and relationships", () => {
  const schema = readFileSync(schemaPath, "utf8");
  const childModel = schema.match(/model Child \{(?<body>[\s\S]*?)\n\}/)?.groups
    ?.body;

  assert.ok(childModel);
  assert.match(childModel, /^\s*id\s+String\s+@id @default\(cuid\(\)\)$/m);
  assert.match(childModel, /^\s*familyId\s+String$/m);
  assert.match(childModel, /^\s*displayName\s+String\s+@db\.VarChar\(80\)$/m);
  assert.match(childModel, /^\s*createdAt\s+DateTime\s+@default\(now\(\)\)$/m);
  assert.match(childModel, /^\s*updatedAt\s+DateTime\s+@updatedAt$/m);
  assert.match(childModel, /onDelete: Restrict/);
  assert.match(childModel, /@@index\(\[familyId\]\)/);
  assert.doesNotMatch(childModel, /@unique|@@unique/);
  assert.doesNotMatch(
    childModel,
    /\b(userId|membershipId|legalName|birthDate|gender|guardianId|pregnancyId|status|medicalId|ownerId)\b/,
  );
});

test("Child migration is additive, non-unique, and restrictive", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /CREATE TABLE "child"/);
  assert.match(migration, /"displayName" VARCHAR\(80\) NOT NULL/);
  assert.doesNotMatch(migration, /"displayName".*DEFAULT/);
  assert.doesNotMatch(migration, /UNIQUE.*displayName|displayName.*UNIQUE/);
  assert.match(migration, /CREATE INDEX "child_familyId_idx"/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(
    migration,
    /DROP|ALTER TABLE "user"|ALTER TABLE "family_membership"|ALTER TABLE "pregnancy"/,
  );
});

test("Child authorization and creation share a serializable transaction", () => {
  const repository = readFileSync(
    join(repositoryRoot, "packages/database/src/prisma-child.repository.ts"),
    "utf8",
  );

  assert.match(repository, /\.\$transaction\(/);
  assert.match(repository, /familyMembership\.findUnique/);
  assert.match(repository, /child\.create/);
  assert.match(repository, /isolationLevel: "Serializable"/);
  assert.match(repository, /familyId_userId/);
});

test("Child persistence scopes mutation atomically without upsert", () => {
  const repository = readFileSync(
    join(repositoryRoot, "packages/database/src/prisma-child.repository.ts"),
    "utf8",
  );

  assert.match(repository, /updateChildDisplayNameForMember/);
  assert.match(repository, /child\.findFirst/);
  assert.match(repository, /memberships/);
  assert.match(repository, /child\.update/);
  assert.match(repository, /isolationLevel: "Serializable"/);
  assert.match(repository, /P2034/);
  assert.doesNotMatch(repository, /child\.upsert/);
});

test("Child HTTP composition exposes only the approved mutation operation", () => {
  const controller = readFileSync(
    join(repositoryRoot, "apps/api/src/child/child.controller.ts"),
    "utf8",
  );

  assert.match(controller, /@Post\(\)/);
  assert.match(controller, /@Get\(\)/);
  assert.match(controller, /@Get\(":childId"\)/);
  assert.match(controller, /@Patch\(":childId"\)/);
  assert.equal(controller.match(/@Patch/g)?.length, 1);
  assert.doesNotMatch(controller, /@Put|@Delete/);
});
