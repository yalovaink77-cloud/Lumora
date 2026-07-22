import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatChildDate,
  mapChildListResponse,
  mapChildResponse,
  upsertChildSorted,
} from "./child-dto";

const childA = {
  id: "child_a",
  familyId: "fam_1",
  displayName: "Alpha",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const childB = {
  id: "child_b",
  familyId: "fam_1",
  displayName: "Beta",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

test("mapChildResponse maps approved fields and enforces familyId", () => {
  assert.deepEqual(mapChildResponse(childA, "fam_1"), childA);
  assert.equal(mapChildResponse(childA, "fam_other"), null);
});

test("mapChildListResponse maps empty and populated lists", () => {
  assert.deepEqual(mapChildListResponse({ children: [] }, "fam_1"), []);
  assert.deepEqual(
    mapChildListResponse({ children: [childA, childB] }, "fam_1"),
    [childA, childB],
  );
});

test("mapChildResponse rejects malformed shapes", () => {
  assert.equal(mapChildResponse(null, "fam_1"), null);
  assert.equal(mapChildResponse({ id: "x" }, "fam_1"), null);
  assert.equal(
    mapChildListResponse({ children: [{ id: "bad" }] }, "fam_1"),
    null,
  );
});

test("upsertChildSorted preserves createdAt then id order", () => {
  const sorted = upsertChildSorted([childB], childA);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["child_a", "child_b"],
  );
});

test("formatChildDate uses conservative YYYY-MM-DD display", () => {
  assert.equal(formatChildDate("2026-07-23T12:00:00.000Z"), "2026-07-23");
});
