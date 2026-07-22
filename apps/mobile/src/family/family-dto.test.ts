import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatFamilyDate,
  mapCreatedFamilyResponse,
  mapFamilyListResponse,
  mapFamilyResponse,
  upsertFamilySorted,
} from "./family-dto";

const familyA = {
  id: "fam_a",
  displayName: "Alpha",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const familyB = {
  id: "fam_b",
  displayName: "Beta",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

test("mapFamilyResponse maps exact approved Family fields", () => {
  assert.deepEqual(mapFamilyResponse(familyA), familyA);
});

test("mapFamilyListResponse maps empty and ordered list payloads", () => {
  assert.deepEqual(mapFamilyListResponse({ families: [] }), []);
  assert.deepEqual(mapFamilyListResponse({ families: [familyA, familyB] }), [
    familyA,
    familyB,
  ]);
});

test("mapCreatedFamilyResponse keeps Family DTO and ignores membership role", () => {
  const mapped = mapCreatedFamilyResponse({
    family: familyA,
    membership: {
      id: "mem_1",
      familyId: familyA.id,
      userId: "user_1",
      role: "OWNER",
      createdAt: familyA.createdAt,
      updatedAt: familyA.updatedAt,
    },
  });

  assert.deepEqual(mapped, familyA);
  assert.equal(
    mapped !== null && !("role" in mapped) && !("membership" in mapped),
    true,
  );
});

test("mapFamilyResponse rejects malformed shapes", () => {
  assert.equal(mapFamilyResponse(null), null);
  assert.equal(mapFamilyResponse({ id: "x" }), null);
  assert.equal(
    mapFamilyResponse({
      ...familyA,
      createdAt: "not-a-date",
    }),
    null,
  );
  assert.equal(mapFamilyListResponse({ families: [{ id: "bad" }] }), null);
});

test("upsertFamilySorted preserves server ordering by createdAt then id", () => {
  const sorted = upsertFamilySorted([familyB], familyA);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["fam_a", "fam_b"],
  );
});

test("formatFamilyDate uses conservative YYYY-MM-DD display", () => {
  assert.equal(formatFamilyDate("2026-07-22T15:30:00.000Z"), "2026-07-22");
});
