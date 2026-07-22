import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("@lumora/family remains independent of NestJS, Better Auth, and Prisma", () => {
  const familySourceDirectory = join(
    process.cwd(),
    "../../packages/family/src",
  );
  const productionSources = readdirSync(familySourceDirectory)
    .filter(
      (fileName) =>
        fileName.endsWith(".ts") &&
        !fileName.endsWith(".test.ts") &&
        !fileName.endsWith(".integration.ts"),
    )
    .map((fileName) =>
      readFileSync(join(familySourceDirectory, fileName), "utf8"),
    )
    .join("\n");

  assert.doesNotMatch(productionSources, /@nestjs/);
  assert.doesNotMatch(productionSources, /better-auth/);
  assert.doesNotMatch(productionSources, /@prisma\/client/);
  assert.doesNotMatch(productionSources, /@lumora\/database/);
  assert.doesNotMatch(productionSources, /new PrismaClient\(/);
  assert.doesNotMatch(productionSources, /node:crypto/);
  assert.doesNotMatch(productionSources, /from\s+["']crypto["']/);
});

test("Family API receives canonicalization through dynamic auth composition", () => {
  const apiFamilySourceDirectory = join(process.cwd(), "src/family");
  const productionSources = readdirSync(apiFamilySourceDirectory)
    .filter(
      (fileName) =>
        fileName.endsWith(".ts") &&
        !fileName.endsWith(".test.ts") &&
        !fileName.endsWith(".integration.ts"),
    )
    .map((fileName) =>
      readFileSync(join(apiFamilySourceDirectory, fileName), "utf8"),
    )
    .join("\n");
  const moduleSource = readFileSync(
    join(apiFamilySourceDirectory, "family.module.ts"),
    "utf8",
  );

  assert.doesNotMatch(productionSources, /from\s+["']@lumora\/auth["']/);
  assert.match(moduleSource, /createAuthRuntimeModule\(\)/);
  assert.match(moduleSource, /new CanonicalEmailAdapter\(canonicalizeEmail\)/);
});

test("FamilyMembership persistence requires an explicitly assigned role", () => {
  const schema = readFileSync(
    join(process.cwd(), "../../packages/database/prisma/schema.prisma"),
    "utf8",
  );
  const migration = readFileSync(
    join(
      process.cwd(),
      "../../packages/database/prisma/migrations/20260721170000_add_family_foundation/migration.sql",
    ),
    "utf8",
  );

  assert.match(schema, /^\s*role\s+FamilyMembershipRole\s*$/m);
  assert.doesNotMatch(
    schema,
    /^\s*role\s+FamilyMembershipRole\s+@default\(OWNER\)\s*$/m,
  );
  assert.match(
    migration,
    /^\s*"role"\s+"FamilyMembershipRole"\s+NOT NULL,\s*$/m,
  );
  assert.doesNotMatch(
    migration,
    /^\s*"role"\s+"FamilyMembershipRole".*DEFAULT\s+'OWNER'/m,
  );
});

test("Sprint 2.8B migration preserves the exact role and invitation architecture", () => {
  const schema = readFileSync(
    join(process.cwd(), "../../packages/database/prisma/schema.prisma"),
    "utf8",
  );
  const foundationMigration = readFileSync(
    join(
      process.cwd(),
      "../../packages/database/prisma/migrations/20260721170000_add_family_foundation/migration.sql",
    ),
    "utf8",
  );
  const migration = readFileSync(
    join(
      process.cwd(),
      "../../packages/database/prisma/migrations/20260722160000_add_family_membership_invitations/migration.sql",
    ),
    "utf8",
  );

  assert.match(
    foundationMigration,
    /CREATE TYPE "FamilyMembershipRole" AS ENUM \('OWNER'\)/,
  );
  assert.match(
    migration,
    /ALTER TYPE "FamilyMembershipRole" ADD VALUE 'MEMBER';[\s\S]*?\bCOMMIT;/s,
  );
  assert.deepEqual(
    [...schema.matchAll(/enum FamilyMembershipRole\s*\{([^}]*)\}/g)].flatMap(
      (match) => match[1]?.match(/\b[A-Z]+\b/g) ?? [],
    ),
    ["OWNER", "MEMBER"],
  );
  assert.match(schema, /^\s*role\s+FamilyMembershipRole\s*$/m);
  assert.doesNotMatch(schema, /role\s+FamilyMembershipRole\s+@default/);
  assert.doesNotMatch(migration, /"role"[^,\n]*DEFAULT/i);

  const firstDdl = migration.search(
    /\b(?:ALTER TYPE|CREATE (?:TABLE|INDEX)|ALTER TABLE)\b/,
  );
  const firstPreflight = migration.indexOf("DO $$");
  assert.ok(firstPreflight >= 0 && firstPreflight < firstDdl);
  assert.match(migration.slice(0, firstDdl), /HAVING COUNT\(fm\."id"\) <> 1/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "family_membership_one_owner_per_family_idx"\s+ON "family_membership"\("familyId"\)\s+WHERE "role" = 'OWNER'/s,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "family_membership_id_familyId_key"\s+ON "family_membership"\("id", "familyId"\)/s,
  );

  const invitationModel = schema.match(
    /model FamilyInvitation\s*\{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(invitationModel);
  for (const field of [
    "id",
    "familyId",
    "inviterMembershipId",
    "targetEmailNormalized",
    "role",
    "secretHash",
    "expiresAt",
    "consumedAt",
    "acceptedByUserId",
    "createdAt",
    "updatedAt",
  ]) {
    assert.match(invitationModel, new RegExp(`^\\s*${field}\\s`, "m"));
  }
  assert.doesNotMatch(
    invitationModel,
    /\b(?:secret|rawSecret|status|delivery|revokedAt|resendCount)\s+String\b/i,
  );
  assert.match(migration, /"secretHash" BYTEA NOT NULL/);
  assert.doesNotMatch(migration, /"invitationSecret"|"rawSecret"/i);
  assert.match(migration, /octet_length\("secretHash"\) = 32/);
  assert.match(migration, /CHECK \("role" = 'MEMBER'\)/);
  assert.match(
    migration,
    /CHECK \(\("consumedAt" IS NULL\) = \("acceptedByUserId" IS NULL\)\)/,
  );
  assert.match(migration, /CHECK \("expiresAt" > "createdAt"\)/);
  assert.match(migration, /family_invitation_secretHash_key/);
  assert.match(migration, /family_invitation_familyId_idx/);
  assert.match(
    migration,
    /family_invitation_familyId_targetEmailNormalized_consumedAt_expiresAt_idx/,
  );
  assert.match(migration, /family_invitation_inviterMembershipId_idx/);
  assert.match(
    migration,
    /FOREIGN KEY \("familyId"\) REFERENCES "family"\("id"\)\s+ON DELETE RESTRICT ON UPDATE RESTRICT/s,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("inviterMembershipId", "familyId"\)\s+REFERENCES "family_membership"\("id", "familyId"\)\s+ON DELETE RESTRICT ON UPDATE RESTRICT/s,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("acceptedByUserId"\) REFERENCES "user"\("id"\)\s+ON DELETE RESTRICT ON UPDATE RESTRICT/s,
  );
  assert.match(foundationMigration, /family_membership_familyId_userId_key/);
});

test("Sprint 2.8B exposes only the approved invitation endpoints and keeps roles out of auth", () => {
  const apiSourceDirectory = join(process.cwd(), "src");
  const familyController = readFileSync(
    join(apiSourceDirectory, "family/family.controller.ts"),
    "utf8",
  );
  const invitationController = readFileSync(
    join(apiSourceDirectory, "family/family-invitation.controller.ts"),
    "utf8",
  );
  const authTypes = readFileSync(
    join(apiSourceDirectory, "auth/auth.types.ts"),
    "utf8",
  );
  const controllers = readdirSync(apiSourceDirectory, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => entry.endsWith(".controller.ts"))
    .map((entry) => readFileSync(join(apiSourceDirectory, entry), "utf8"))
    .join("\n");

  assert.match(familyController, /@Post\(":familyId\/invitations"\)/);
  assert.match(invitationController, /@Post\("accept"\)/);
  assert.equal(
    (controllers.match(/@Post\(":familyId\/invitations"\)/g) ?? []).length,
    1,
  );
  assert.equal((controllers.match(/@Post\("accept"\)/g) ?? []).length, 1);
  assert.doesNotMatch(
    controllers,
    /@(Get|Patch|Put|Delete|Post)\([^)]*"(?:members|memberships|invitations\/(?:resend|revoke|reject)|leave|transfer|roles?)[^"]*"/i,
  );
  assert.doesNotMatch(
    authTypes,
    /\b(?:familyId|familyRole|role|roles|permissions)\b/,
  );
});
