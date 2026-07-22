import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const appRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(appRoot, relativePath), "utf8");
}

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

test("Home provides Families entry and preserves Safety and sign-out", () => {
  const home = read("app/(app)/index.tsx");
  assert.match(home, /\/\(app\)\/families/);
  assert.match(home, /Open Families/);
  assert.match(home, /\/\(app\)\/safety/);
  assert.match(home, /Sign out/);
  assert.doesNotMatch(
    home,
    /member count|invitation|Open Pregnancy|Open Timeline/i,
  );
});

test("approved Family routes exist under authenticated app group", () => {
  assert.equal(existsSync(join(appRoot, "app/(app)/families/index.tsx")), true);
  assert.equal(
    existsSync(join(appRoot, "app/(app)/families/create.tsx")),
    true,
  );
  assert.equal(
    existsSync(join(appRoot, "app/(app)/families/[familyId].tsx")),
    true,
  );

  const appLayout = read("app/(app)/_layout.tsx");
  assert.match(appLayout, /resolveShellRedirect/);
  assert.match(appLayout, /group: "app"/);
});

test("Family list/create/detail screens cover required UX without excluded UI", () => {
  const list = read("app/(app)/families/index.tsx");
  const create = read("app/(app)/families/create.tsx");
  const detail = read("app/(app)/families/[familyId].tsx");

  assert.match(list, /RefreshControl/);
  assert.match(list, /You do not have any Families yet/);
  assert.match(list, /Create Family/);
  assert.match(list, /accessibilityRole="header"/);
  assert.match(list, /accessibilityRole="list"/);
  assert.doesNotMatch(list, /membership\.role|Invite member|Open invitation/i);
  assert.doesNotMatch(
    list,
    /href=\{?`?\/\(app\)\/pregnanc|href=\{?`?\/\(app\)\/timeline|href=\{?`?\/\(app\)\/child/i,
  );

  assert.match(create, /parseCreateFamilyInput/);
  assert.match(create, /disabled=\{submitting\}/);
  assert.match(create, /families\/\$\{result\.family\.id\}/);
  assert.doesNotMatch(create, /avatar|Invite member|role selection/i);

  assert.match(detail, /loadFamilyDetail/);
  assert.match(detail, /Family not found/);
  assert.match(detail, /Back to Families/);
  assert.doesNotMatch(
    detail,
    /Invite member|member directory|onRename|onDelete/i,
  );
  assert.doesNotMatch(
    detail,
    /href=\{?`?\/\(app\)\/pregnanc|href=\{?`?\/\(app\)\/timeline|href=\{?`?\/\(app\)\/child/i,
  );
});

test("Family API client uses cookie transport without bearer token or backend imports", () => {
  const client = read("src/family/family-api-client.ts");
  assert.match(client, /Cookie/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /AbortController/);
  assert.match(client, /encodeURIComponent\(familyId\)/);
  assert.doesNotMatch(client, /Bearer |Authorization:|@nestjs|@prisma\/client/);
  assert.doesNotMatch(client, /console\.(log|info|debug|warn|error)/);
});

test("Family state is process-memory only and clears on principal change/sign-out", () => {
  const provider = read("src/family/FamilyProvider.tsx");
  const state = read("src/family/family-state.ts");
  const layout = read("app/_layout.tsx");

  assert.match(layout, /FamilyProvider/);
  assert.match(provider, /bindFamilyPrincipal/);
  assert.match(provider, /clearFamilyMemoryState/);
  assert.match(provider, /handleUnauthorized/);
  assert.match(provider, /session\.signOut/);
  assert.match(provider, /loadFamiliesInternal\("loading"\)/);
  assert.doesNotMatch(provider, /AsyncStorage|SecureStore|SQLite|MMKV/);
  assert.doesNotMatch(state, /AsyncStorage|SecureStore|SQLite|MMKV/);

  for (const filePath of collectSourceFiles(join(appRoot, "src/family"))) {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /AsyncStorage|expo-sqlite|MMKV/);
    assert.doesNotMatch(source, /@nestjs|@prisma\/client|from "prisma"/);
    assert.doesNotMatch(source, /analytics|segment|sentry|amplitude/i);
  }
});

test("create mapping never stores membership.role in MobileFamily DTO", () => {
  const types = read("src/family/family.types.ts");
  const dto = read("src/family/family-dto.ts");
  assert.match(types, /export type MobileFamily/);
  assert.doesNotMatch(types, /role/);
  assert.match(dto, /mapCreatedFamilyResponse/);
  assert.match(dto, /mapFamilyResponse\(body\.family\)/);
});

test("regression: auth transport and disclosure surfaces remain present", () => {
  assert.match(
    read("src/auth/mobile-auth-transport.ts"),
    /expo-secure-store|SecureStore/,
  );
  assert.match(read("app/disclosure.tsx"), /continueDisclosure/);
  assert.match(read("app/(app)/safety.tsx"), /SafetyDisclosureBody/);
  assert.match(
    read("src/auth/mobile-auth-client.ts"),
    /getMobileAuthClient|createMobileAuthClient|expo-secure-store/,
  );
  assert.match(
    read("src/auth/create-mobile-auth-client.ts"),
    /@better-auth\/expo\/client/,
  );
  assert.match(read("src/family/FamilyProvider.tsx"), /getCookie\(\)/);
});
