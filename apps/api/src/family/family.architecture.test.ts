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
      (fileName) => fileName.endsWith(".ts") && !fileName.endsWith(".test.ts"),
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
