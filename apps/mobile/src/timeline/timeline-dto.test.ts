import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mapChildTimelineEventResponse,
  mapPregnancyTimelineEventResponse,
  mapPregnancyTimelineListResponse,
  upsertTimelineEventSorted,
} from "./timeline-dto";

const pregnancyEvent = {
  id: "evt_1",
  familyId: "fam_1",
  pregnancyId: "preg_1",
  title: "Note",
  occurredAt: "2026-07-22T11:10:00.123Z",
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

const childEvent = {
  id: "evt_2",
  familyId: "fam_1",
  childId: "child_1",
  title: "Step",
  occurredAt: "2026-07-21T09:00:00.000Z",
  createdAt: "2026-07-21T10:00:00.000Z",
  updatedAt: "2026-07-21T10:00:00.000Z",
};

test("maps Pregnancy event and rejects Child field or wrong subject", () => {
  assert.deepEqual(
    mapPregnancyTimelineEventResponse(pregnancyEvent, "fam_1", "preg_1"),
    pregnancyEvent,
  );
  assert.equal(
    mapPregnancyTimelineEventResponse(
      { ...pregnancyEvent, childId: "child_1" },
      "fam_1",
      "preg_1",
    ),
    null,
  );
  assert.equal(
    mapPregnancyTimelineEventResponse(pregnancyEvent, "fam_1", "other"),
    null,
  );
  assert.equal(
    mapPregnancyTimelineEventResponse(childEvent, "fam_1", "preg_1"),
    null,
  );
});

test("maps Child event and rejects Pregnancy field or wrong subject", () => {
  assert.deepEqual(
    mapChildTimelineEventResponse(childEvent, "fam_1", "child_1"),
    childEvent,
  );
  assert.equal(
    mapChildTimelineEventResponse(
      { ...childEvent, pregnancyId: "preg_1" },
      "fam_1",
      "child_1",
    ),
    null,
  );
  assert.equal(
    mapChildTimelineEventResponse(pregnancyEvent, "fam_1", "child_1"),
    null,
  );
});

test("list mapping preserves payload order and upsert sorts by server keys", () => {
  const later = {
    ...pregnancyEvent,
    id: "evt_later",
    occurredAt: "2026-07-23T11:10:00.000Z",
  };
  const list = mapPregnancyTimelineListResponse(
    { timelineEvents: [later, pregnancyEvent] },
    "fam_1",
    "preg_1",
  );
  assert.deepEqual(
    list?.map((item) => item.id),
    ["evt_later", "evt_1"],
  );

  const upserted = upsertTimelineEventSorted([pregnancyEvent], later);
  assert.deepEqual(
    upserted.map((item) => item.id),
    ["evt_later", "evt_1"],
  );
});
