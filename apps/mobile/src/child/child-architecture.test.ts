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

test("Family detail provides Children entry without Timeline controls", () => {
  const detail = read("app/(app)/families/[familyId].tsx");
  assert.match(detail, /Open Children/);
  assert.match(detail, /\/children/);
  assert.match(detail, /Open Pregnancies/);
  assert.doesNotMatch(detail, /Open Timeline|href=.*\/timeline/i);
});

test("approved nested Child routes exist under authenticated app group", () => {
  assert.equal(
    existsSync(
      join(appRoot, "app/(app)/families/[familyId]/children/index.tsx"),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(appRoot, "app/(app)/families/[familyId]/children/create.tsx"),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/children/[childId]/index.tsx",
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/children/[childId]/edit.tsx",
      ),
    ),
    true,
  );

  const appLayout = read("app/(app)/_layout.tsx");
  assert.match(appLayout, /resolveShellRedirect/);
  assert.match(appLayout, /group: "app"/);
});

test("Child screens cover required UX without excluded medical/Timeline UI", () => {
  const list = read("app/(app)/families/[familyId]/children/index.tsx");
  const create = read("app/(app)/families/[familyId]/children/create.tsx");
  const detail = read(
    "app/(app)/families/[familyId]/children/[childId]/index.tsx",
  );
  const edit = read(
    "app/(app)/families/[familyId]/children/[childId]/edit.tsx",
  );

  assert.match(list, /RefreshControl/);
  assert.match(list, /You do not have any Children/);
  assert.match(list, /Create Child/);
  assert.match(list, /not legal or\s+verified identities/i);
  assert.doesNotMatch(list, /birth date|guardian|\bgender\b|\bage\b/i);
  assert.doesNotMatch(list, /href=.*\/timeline|href=.*\/pregnanc/i);

  assert.match(create, /parseCreateChildInput/);
  assert.match(create, /disabled=\{submitting\}/);
  assert.match(create, /not a[\s\S]*legal[\s\S]*verified name/i);
  assert.doesNotMatch(create, /birthDate|guardian|pregnancyId|timeline/i);

  assert.match(detail, /loadChildDetail/);
  assert.match(detail, /Child not found/);
  assert.match(detail, /Edit Child display name/);
  assert.match(detail, /\/edit/);
  assert.match(detail, /Back to Children/);
  assert.doesNotMatch(
    detail,
    /onDelete|guardian|birth date|href=.*\/timeline/i,
  );

  assert.match(edit, /parseUpdateChildDisplayNameInput/);
  assert.match(edit, /updateChildDisplayName/);
  assert.match(edit, /disabled=\{submitting\}/);
  assert.match(edit, /Save Child display name/);
  assert.doesNotMatch(edit, /familyId mutation|onDelete|birthDate|guardian/i);
});

test("Child API client uses cookie transport without bearer token or backend imports", () => {
  const client = read("src/child/child-api-client.ts");
  assert.match(client, /Cookie/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /AbortController/);
  assert.match(client, /encodeURIComponent\(familyId\)/);
  assert.match(client, /encodeURIComponent\(childId\)/);
  assert.match(client, /method: "PATCH"/);
  assert.doesNotMatch(client, /Bearer |Authorization:|@nestjs|@prisma\/client/);
  assert.doesNotMatch(client, /console\.(log|info|debug|warn|error)/);
});

test("Child state is process-memory only and Family-scoped", () => {
  const provider = read("src/child/ChildProvider.tsx");
  const state = read("src/child/child-state.ts");
  const layout = read("app/_layout.tsx");

  assert.match(layout, /ChildProvider/);
  assert.match(provider, /bindChildPrincipal/);
  assert.match(provider, /clearChildMemoryState/);
  assert.match(provider, /handleUnauthorized/);
  assert.match(provider, /session\.signOut/);
  assert.match(provider, /updateChildDisplayName/);
  assert.match(provider, /applyChildDisplayNameUpdate/);
  assert.match(state, /bindChildFamilyContext/);
  assert.doesNotMatch(provider, /AsyncStorage|SecureStore|SQLite|MMKV/);
  assert.doesNotMatch(state, /AsyncStorage|SecureStore|SQLite|MMKV/);

  for (const filePath of collectSourceFiles(join(appRoot, "src/child"))) {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /AsyncStorage|expo-sqlite|MMKV/);
    assert.doesNotMatch(source, /@nestjs|@prisma\/client|from "prisma"/);
    assert.doesNotMatch(source, /analytics|segment|sentry|amplitude/i);
  }
});

test("regression: Safety, Family, and Pregnancy routes remain present", () => {
  assert.match(read("app/(app)/safety.tsx"), /SafetyDisclosureBody/);
  assert.match(read("app/(app)/index.tsx"), /Open Families/);
  assert.match(read("app/(app)/index.tsx"), /Safety and Limitations/);
  assert.match(read("app/disclosure.tsx"), /continueDisclosure/);
  assert.match(read("app/(app)/families/[familyId].tsx"), /Open Pregnancies/);
  assert.equal(
    existsSync(
      join(appRoot, "app/(app)/families/[familyId]/pregnancies/index.tsx"),
    ),
    true,
  );
});
