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

test("Pregnancy and Child detail provide Timeline entries", () => {
  const pregnancyDetail = read(
    "app/(app)/families/[familyId]/pregnancies/[pregnancyId].tsx",
  );
  const childDetail = read(
    "app/(app)/families/[familyId]/children/[childId]/index.tsx",
  );
  assert.match(pregnancyDetail, /Open Pregnancy Timeline/);
  assert.match(childDetail, /Open Child Timeline/);
});

test("approved subject-specific Timeline routes exist", () => {
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/pregnancies/[pregnancyId]/timeline/index.tsx",
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/pregnancies/[pregnancyId]/timeline/create.tsx",
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/pregnancies/[pregnancyId]/timeline/[timelineEventId].tsx",
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/children/[childId]/timeline/index.tsx",
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/children/[childId]/timeline/create.tsx",
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        appRoot,
        "app/(app)/families/[familyId]/children/[childId]/timeline/[timelineEventId].tsx",
      ),
    ),
    true,
  );
});

test("Timeline screens use subject-specific flows without medical/Media UI", () => {
  const list = read("src/timeline/TimelineListScreen.tsx");
  const create = read("src/timeline/TimelineCreateScreen.tsx");
  const detail = read("src/timeline/TimelineDetailScreen.tsx");
  const picker = read("src/timeline/TimelineOccurredAtFields.tsx");

  assert.match(list, /RefreshControl/);
  assert.match(list, /unverified[\s\S]*historical statements/i);
  assert.doesNotMatch(list, /gestational|trimester|risk score|developmental/i);

  assert.match(create, /parseCreateTimelineEventInput/);
  assert.match(create, /occurredAtConfirmed/);
  assert.match(picker, /@react-native-community\/datetimepicker/);
  assert.match(picker, /Confirm date and time/);
  assert.doesNotMatch(create, /\bcategory\b|\bmedia\b|\bhealth\b|ai content/i);

  assert.match(detail, /Timeline resource not found/);
  assert.match(detail, /Not a medical[\s\S]*record/);
  assert.doesNotMatch(detail, /onEdit|onDelete|href=.*\/health/i);
});

test("datetimepicker dependency is Expo-compatible and no native projects exist", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    dependencies: Record<string, string>;
  };
  assert.equal(
    packageJson.dependencies["@react-native-community/datetimepicker"],
    "9.1.0",
  );
  assert.match(read("app.json"), /@react-native-community\/datetimepicker/);
  assert.equal(existsSync(join(appRoot, "android")), false);
  assert.equal(existsSync(join(appRoot, "ios")), false);
});

test("Timeline API client and state preserve privacy and subject scoping", () => {
  const client = read("src/timeline/timeline-api-client.ts");
  const provider = read("src/timeline/TimelineProvider.tsx");
  const state = read("src/timeline/timeline-state.ts");
  const layout = read("app/_layout.tsx");

  assert.match(layout, /TimelineProvider/);
  assert.match(client, /listPregnancyTimelineEvents/);
  assert.match(client, /listChildTimelineEvents/);
  assert.match(client, /credentials: "omit"/);
  assert.match(provider, /bindTimelinePrincipal/);
  assert.match(state, /bindTimelineSubjectContext/);
  assert.doesNotMatch(client, /Bearer |@nestjs|@prisma\/client/);
  assert.doesNotMatch(provider, /AsyncStorage|SecureStore|SQLite|MMKV/);

  for (const filePath of collectSourceFiles(join(appRoot, "src/timeline"))) {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /AsyncStorage|expo-sqlite|MMKV/);
    assert.doesNotMatch(source, /analytics|segment|sentry|amplitude/i);
  }
});
