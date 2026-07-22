import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const appRoot = process.cwd();

function listRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(fullPath));
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

test("Expo Router exposes disclosure, Safety, Family, and Pregnancy routes", () => {
  assert.equal(existsSync(join(appRoot, "app/(auth)/sign-in.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/(auth)/register.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/disclosure.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/(app)/index.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/(app)/safety.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/(app)/families/index.tsx")), true);
  assert.equal(
    existsSync(join(appRoot, "app/(app)/families/create.tsx")),
    true,
  );
  assert.equal(
    existsSync(join(appRoot, "app/(app)/families/[familyId].tsx")),
    true,
  );
  assert.equal(
    existsSync(
      join(appRoot, "app/(app)/families/[familyId]/pregnancies/index.tsx"),
    ),
    true,
  );

  const routeFiles = listRouteFiles(join(appRoot, "app"));
  const routeNames = routeFiles.map((file) => file.slice(appRoot.length));
  const joined = routeFiles
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.equal(
    routeNames.some((name) => /timeline|invitation/i.test(name)),
    false,
  );
  assert.equal(
    routeNames.some((name) => /\/families\/.*\/pregnancies/.test(name)),
    true,
  );
  assert.doesNotMatch(joined, /\bOWNER\b|\bMEMBER\b/);
  assert.doesNotMatch(joined, /AsyncStorage|jsonwebtoken|Bearer /);
  assert.doesNotMatch(joined, /\/children|\/timeline/);
  assert.match(joined, /\/\(app\)\/families/);
  assert.match(joined, /\/pregnancies/);
  assert.match(
    readFileSync(join(appRoot, "src/safety/SafetyDisclosureBody.tsx"), "utf8"),
    /@lumora\/shared|LUMORA_MVP_SAFETY/,
  );
});

test("disclosure state is in-memory only and not part of principal/session", () => {
  const sessionSource = readFileSync(
    join(appRoot, "src/auth/auth-session-context.tsx"),
    "utf8",
  );
  const disclosureSource = readFileSync(
    join(appRoot, "src/auth/disclosure-process-state.ts"),
    "utf8",
  );
  const principalSource = readFileSync(
    join(appRoot, "src/auth/neutral-principal.ts"),
    "utf8",
  );
  const safetySource = readFileSync(
    join(appRoot, "src/safety/SafetyDisclosureBody.tsx"),
    "utf8",
  );

  assert.match(sessionSource, /continueDisclosure/);
  assert.match(sessionSource, /resetDisclosureProcessState/);
  assert.match(disclosureSource, /continuedForPrincipalId/);
  assert.doesNotMatch(disclosureSource, /AsyncStorage|SecureStore|fetch\(/);
  assert.doesNotMatch(principalSource, /disclosure|continued|consent/i);
  assert.doesNotMatch(sessionSource, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(safetySource, /analytics|track\(|consent|I agree/i);
  assert.doesNotMatch(safetySource, /FamilyMembership|OWNER|MEMBER/);
  assert.match(safetySource, /@lumora\/shared/);
});

test("session shell uses Better Auth Expo cookie transport and /auth/me", () => {
  const sessionSource = readFileSync(
    join(appRoot, "src/auth/auth-session-context.tsx"),
    "utf8",
  );
  const principalSource = readFileSync(
    join(appRoot, "src/auth/fetch-neutral-principal.ts"),
    "utf8",
  );
  const packageJson = readFileSync(join(appRoot, "package.json"), "utf8");
  const appJson = readFileSync(join(appRoot, "app.json"), "utf8");

  assert.match(packageJson, /"expo-router"/);
  assert.match(packageJson, /"main": "expo-router\/entry"/);
  assert.match(appJson, /expo-router/);
  assert.match(sessionSource, /signIn\.email/);
  assert.match(sessionSource, /signUp\.email/);
  assert.match(sessionSource, /signOut/);
  assert.match(sessionSource, /getCookie/);
  assert.match(principalSource, /\/auth\/me/);
  assert.match(principalSource, /credentials: "omit"/);
});
