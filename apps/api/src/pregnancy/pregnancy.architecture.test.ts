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
  "packages/database/prisma/migrations/20260721183000_add_pregnancy_foundation/migration.sql",
);

test("@lumora/pregnancy remains independent of application and infrastructure", () => {
  const pregnancySourceDirectory = join(
    repositoryRoot,
    "packages/pregnancy/src",
  );
  const productionSources = readdirSync(pregnancySourceDirectory)
    .filter(
      (fileName) => fileName.endsWith(".ts") && !fileName.endsWith(".test.ts"),
    )
    .map((fileName) =>
      readFileSync(join(pregnancySourceDirectory, fileName), "utf8"),
    )
    .join("\n");

  assert.doesNotMatch(productionSources, /@nestjs/);
  assert.doesNotMatch(productionSources, /better-auth/);
  assert.doesNotMatch(productionSources, /@prisma\/client/);
  assert.doesNotMatch(productionSources, /@lumora\/database/);
  assert.doesNotMatch(productionSources, /new PrismaClient\(/);
});

test("Pregnancy persistence contains only approved fields and relationships", () => {
  const schema = readFileSync(schemaPath, "utf8");
  const pregnancyModel = schema.match(/model Pregnancy \{(?<body>[\s\S]*?)\n\}/)
    ?.groups?.body;

  assert.ok(pregnancyModel);
  assert.match(pregnancyModel, /^\s*id\s+String\s+@id @default\(cuid\(\)\)$/m);
  assert.match(pregnancyModel, /^\s*familyId\s+String$/m);
  assert.match(
    pregnancyModel,
    /^\s*displayName\s+String\s+@db\.VarChar\(100\)$/m,
  );
  assert.match(
    pregnancyModel,
    /^\s*createdAt\s+DateTime\s+@default\(now\(\)\)$/m,
  );
  assert.match(pregnancyModel, /^\s*updatedAt\s+DateTime\s+@updatedAt$/m);
  assert.match(pregnancyModel, /onDelete: Restrict/);
  assert.match(pregnancyModel, /@@index\(\[familyId\]\)/);
  assert.doesNotMatch(pregnancyModel, /@unique|@@unique/);
  assert.doesNotMatch(
    pregnancyModel,
    /\b(userId|membershipId|status|childId|estimatedDueDate|dueDate)\b/,
  );
});

test("Pregnancy migration is additive, non-unique, and restrictive", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /CREATE TABLE "pregnancy"/);
  assert.match(migration, /"displayName" VARCHAR\(100\) NOT NULL/);
  assert.doesNotMatch(migration, /"displayName".*DEFAULT/);
  assert.doesNotMatch(migration, /UNIQUE.*displayName|displayName.*UNIQUE/);
  assert.match(migration, /CREATE INDEX "pregnancy_familyId_idx"/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(
    migration,
    /DROP|ALTER TABLE "user"|ALTER TABLE "family_membership"/,
  );
});

test("Pregnancy creation authorization and write share a serializable transaction", () => {
  const repository = readFileSync(
    join(
      repositoryRoot,
      "packages/database/src/prisma-pregnancy.repository.ts",
    ),
    "utf8",
  );

  assert.match(repository, /\.\$transaction\(/);
  assert.match(repository, /familyMembership\.findUnique/);
  assert.match(repository, /pregnancy\.create/);
  assert.match(repository, /isolationLevel: "Serializable"/);
  assert.match(repository, /familyId_userId/);
});

test("Pregnancy HTTP composition exposes no update or deletion operation", () => {
  const controller = readFileSync(
    join(repositoryRoot, "apps/api/src/pregnancy/pregnancy.controller.ts"),
    "utf8",
  );

  assert.match(controller, /@Post\(\)/);
  assert.match(controller, /@Get\(\)/);
  assert.match(controller, /@Get\(":pregnancyId"\)/);
  assert.doesNotMatch(controller, /@Put|@Patch|@Delete/);
});
