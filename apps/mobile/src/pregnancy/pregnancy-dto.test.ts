import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatPregnancyDate,
  mapPregnancyListResponse,
  mapPregnancyResponse,
  upsertPregnancySorted,
} from "./pregnancy-dto";

const pregnancyA = {
  id: "preg_a",
  familyId: "fam_1",
  displayName: "Alpha",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const pregnancyB = {
  id: "preg_b",
  familyId: "fam_1",
  displayName: "Beta",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

test("mapPregnancyResponse maps approved fields and enforces familyId", () => {
  assert.deepEqual(mapPregnancyResponse(pregnancyA, "fam_1"), pregnancyA);
  assert.equal(mapPregnancyResponse(pregnancyA, "fam_other"), null);
});

test("mapPregnancyListResponse maps empty and populated lists", () => {
  assert.deepEqual(mapPregnancyListResponse({ pregnancies: [] }, "fam_1"), []);
  assert.deepEqual(
    mapPregnancyListResponse(
      { pregnancies: [pregnancyA, pregnancyB] },
      "fam_1",
    ),
    [pregnancyA, pregnancyB],
  );
});

test("mapPregnancyResponse rejects malformed shapes", () => {
  assert.equal(mapPregnancyResponse(null, "fam_1"), null);
  assert.equal(mapPregnancyResponse({ id: "x" }, "fam_1"), null);
  assert.equal(
    mapPregnancyListResponse({ pregnancies: [{ id: "bad" }] }, "fam_1"),
    null,
  );
});

test("upsertPregnancySorted preserves createdAt then id order", () => {
  const sorted = upsertPregnancySorted([pregnancyB], pregnancyA);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["preg_a", "preg_b"],
  );
});

test("formatPregnancyDate uses conservative YYYY-MM-DD display", () => {
  assert.equal(formatPregnancyDate("2026-07-23T12:00:00.000Z"), "2026-07-23");
});
