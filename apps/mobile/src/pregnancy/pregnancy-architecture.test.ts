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

test("Family detail provides Pregnancies entry without Timeline controls", () => {
  const detail = read("app/(app)/families/[familyId].tsx");
  assert.match(detail, /Open Pregnancies/);
  assert.match(detail, /\/pregnancies/);
  assert.doesNotMatch(detail, /Open Timeline|href=.*\/timeline/i);
});

test("approved nested Pregnancy routes exist under authenticated app group", () => {
  assert.equal(
    existsSync(
      join(appRoot, "app/(app)/families/[familyId]/pregnancies/index.tsx"),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(appRoot, "app/(app)/families/[familyId]/pregnancies/create.tsx"),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/pregnancies/[pregnancyId].tsx",
      ),
    ),
    true,
  );

  const appLayout = read("app/(app)/_layout.tsx");
  assert.match(appLayout, /resolveShellRedirect/);
  assert.match(appLayout, /group: "app"/);
});

test("Pregnancy screens cover required UX without excluded medical/Child/Timeline UI", () => {
  const list = read("app/(app)/families/[familyId]/pregnancies/index.tsx");
  const create = read("app/(app)/families/[familyId]/pregnancies/create.tsx");
  const detail = read(
    "app/(app)/families/[familyId]/pregnancies/[pregnancyId].tsx",
  );

  assert.match(list, /RefreshControl/);
  assert.match(list, /You do not have any Pregnancies/);
  assert.match(list, /Create Pregnancy/);
  assert.match(list, /not\s+clinical records/i);
  assert.doesNotMatch(list, /trimester|gestational|due date|risk score/i);
  assert.doesNotMatch(list, /href=.*\/timeline|href=.*\/child/i);

  assert.match(create, /parseCreatePregnancyInput/);
  assert.match(create, /disabled=\{submitting\}/);
  assert.match(create, /not a\s+clinical record/i);
  assert.doesNotMatch(create, /dueDate|trimester|doctor|symptoms/i);

  assert.match(detail, /loadPregnancyDetail/);
  assert.match(detail, /Pregnancy not found/);
  assert.match(detail, /Back to Pregnancies/);
  assert.doesNotMatch(
    detail,
    /Open Child|onRename|onDelete|gestational|href=.*\/timeline/i,
  );
  assert.doesNotMatch(detail, /href=\{?`?\/\(app\)\/.*\/timeline/i);
});

test("Pregnancy API client uses cookie transport without bearer token or backend imports", () => {
  const client = read("src/pregnancy/pregnancy-api-client.ts");
  assert.match(client, /Cookie/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /AbortController/);
  assert.match(client, /encodeURIComponent\(familyId\)/);
  assert.match(client, /encodeURIComponent\(pregnancyId\)/);
  assert.doesNotMatch(client, /Bearer |Authorization:|@nestjs|@prisma\/client/);
  assert.doesNotMatch(client, /console\.(log|info|debug|warn|error)/);
});

test("Pregnancy state is process-memory only and Family-scoped", () => {
  const provider = read("src/pregnancy/PregnancyProvider.tsx");
  const state = read("src/pregnancy/pregnancy-state.ts");
  const layout = read("app/_layout.tsx");

  assert.match(layout, /PregnancyProvider/);
  assert.match(provider, /bindPregnancyPrincipal/);
  assert.match(provider, /clearPregnancyMemoryState/);
  assert.match(provider, /handleUnauthorized/);
  assert.match(provider, /session\.signOut/);
  assert.match(state, /bindPregnancyFamilyContext/);
  assert.doesNotMatch(provider, /AsyncStorage|SecureStore|SQLite|MMKV/);
  assert.doesNotMatch(state, /AsyncStorage|SecureStore|SQLite|MMKV/);

  for (const filePath of collectSourceFiles(join(appRoot, "src/pregnancy"))) {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /AsyncStorage|expo-sqlite|MMKV/);
    assert.doesNotMatch(source, /@nestjs|@prisma\/client|from "prisma"/);
    assert.doesNotMatch(source, /analytics|segment|sentry|amplitude/i);
  }
});

test("regression: Safety & Limitations and Family routes remain present", () => {
  assert.match(read("app/(app)/safety.tsx"), /SafetyDisclosureBody/);
  assert.match(read("app/(app)/index.tsx"), /Open Families/);
  assert.match(read("app/(app)/index.tsx"), /Safety and Limitations/);
  assert.match(read("app/disclosure.tsx"), /continueDisclosure/);
});
