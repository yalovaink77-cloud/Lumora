import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { getPrismaClient } from "@lumora/database";

test("Better Auth uses the shared Prisma Client singleton", () => {
  const databaseSource = readFileSync(
    join(process.cwd(), "../../packages/auth/src/create-auth.ts"),
    "utf8",
  );

  assert.match(databaseSource, /getPrismaClient\(\)/);
  assert.doesNotMatch(databaseSource, /new PrismaClient\(/);
  assert.equal(typeof getPrismaClient, "function");
});

test("domain package does not import Better Auth", () => {
  const domainSource = readFileSync(
    join(process.cwd(), "../../packages/domain/src/index.ts"),
    "utf8",
  );

  assert.doesNotMatch(domainSource, /better-auth/);
});

test("auth composition registers Better Auth Expo plugin without React Native", () => {
  const createAuthSource = readFileSync(
    join(process.cwd(), "../../packages/auth/src/create-auth.ts"),
    "utf8",
  );
  const authConfigSource = readFileSync(
    join(process.cwd(), "../../packages/auth/src/auth-config.ts"),
    "utf8",
  );
  const authPackageJson = readFileSync(
    join(process.cwd(), "../../packages/auth/package.json"),
    "utf8",
  );

  assert.match(createAuthSource, /from "@better-auth\/expo"/);
  assert.match(createAuthSource, /expo\(\)/);
  assert.match(authPackageJson, /"@better-auth\/expo": "1\.6\.23"/);
  assert.match(authConfigSource, /lumora:\/\//);
  assert.match(authConfigSource, /allowExpoDevelopmentOrigins/);
  assert.doesNotMatch(createAuthSource, /react-native|expo-secure-store/);
});
