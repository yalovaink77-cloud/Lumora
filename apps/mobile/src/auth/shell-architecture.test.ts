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

test("Expo Router auth and app route groups exist without Family feature screens", () => {
  assert.equal(existsSync(join(appRoot, "app/(auth)/sign-in.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/(auth)/register.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/(app)/index.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/(auth)/_layout.tsx")), true);
  assert.equal(existsSync(join(appRoot, "app/(app)/_layout.tsx")), true);

  const routeFiles = listRouteFiles(join(appRoot, "app"));
  const routeNames = routeFiles.map((file) => file.slice(appRoot.length));
  const joined = routeFiles
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.equal(
    routeNames.some((name) =>
      /family|pregnancy|child|timeline|invitation|safety/i.test(name),
    ),
    false,
  );
  assert.doesNotMatch(joined, /\bOWNER\b|\bMEMBER\b|familyId/);
  assert.doesNotMatch(joined, /AsyncStorage|jsonwebtoken|Bearer /);
  assert.doesNotMatch(joined, /\/families|\/pregnancies|\/children|\/timeline/);
  assert.doesNotMatch(joined, /lumora\.safety\.mvp\.medical-ai\.v1/);
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
  assert.doesNotMatch(sessionSource, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(principalSource, /console\.(log|info|debug|warn|error)/);
});
