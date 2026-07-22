import assert from "node:assert/strict";
import { test } from "node:test";

import { upsertTimelineEventSorted } from "./timeline-dto";
import {
  applyTimelineDetailSuccess,
  applyTimelineListSuccess,
  applyTimelineListUnavailable,
  beginTimelineDetailLoad,
  beginTimelineListLoad,
  bindTimelinePrincipal,
  bindTimelineSubjectContext,
  clearTimelineMemoryState,
  createInitialTimelineMemoryState,
} from "./timeline-state";

const pregnancySubject = {
  familyId: "fam_1",
  subjectType: "pregnancy" as const,
  subjectId: "preg_1",
};

const childSubject = {
  familyId: "fam_1",
  subjectType: "child" as const,
  subjectId: "child_1",
};

const event = {
  id: "evt_1",
  familyId: "fam_1",
  pregnancyId: "preg_1",
  title: "Note",
  occurredAt: "2026-07-22T11:10:00.123Z",
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

test("principal and subject isolation clear Timeline memory", () => {
  let state = bindTimelinePrincipal(
    createInitialTimelineMemoryState(),
    "user_1",
  );
  state = beginTimelineListLoad(state, pregnancySubject, "loading");
  state = applyTimelineListSuccess(state, {
    principalId: "user_1",
    subject: pregnancySubject,
    generation: state.listGeneration,
    events: [event],
  });

  const otherUser = bindTimelinePrincipal(state, "user_2");
  assert.deepEqual(otherUser.events, []);

  const otherSubject = bindTimelineSubjectContext(state, childSubject);
  assert.equal(otherSubject.subjectType, "child");
  assert.deepEqual(otherSubject.events, []);
});

test("stale list response for another subject is ignored", () => {
  let state = bindTimelinePrincipal(
    createInitialTimelineMemoryState(),
    "user_1",
  );
  state = beginTimelineListLoad(state, pregnancySubject, "loading");
  const staleGeneration = state.listGeneration;
  state = beginTimelineListLoad(state, childSubject, "loading");

  const after = applyTimelineListSuccess(state, {
    principalId: "user_1",
    subject: pregnancySubject,
    generation: staleGeneration,
    events: [event],
  });
  assert.equal(after.subjectType, "child");
  assert.deepEqual(after.events, []);
});

test("TIMELINE_NOT_FOUND marks list unavailable", () => {
  let state = bindTimelinePrincipal(
    createInitialTimelineMemoryState(),
    "user_1",
  );
  state = beginTimelineListLoad(state, pregnancySubject, "loading");
  state = applyTimelineListUnavailable(state, {
    principalId: "user_1",
    subject: pregnancySubject,
    generation: state.listGeneration,
  });
  assert.equal(state.listStatus, "unavailable");
});

test("direct-get updates detail and matching list entry", () => {
  let state = bindTimelinePrincipal(
    createInitialTimelineMemoryState(),
    "user_1",
  );
  state = beginTimelineDetailLoad(state, pregnancySubject, event.id);
  state = applyTimelineDetailSuccess(state, {
    principalId: "user_1",
    subject: pregnancySubject,
    generation: state.detailGeneration,
    eventId: event.id,
    event,
    upsert: upsertTimelineEventSorted,
  });
  assert.equal(state.detailStatus, "ready");
  assert.deepEqual(state.detail, event);
  assert.deepEqual(state.events, [event]);
});

test("clearTimelineMemoryState resets all Timeline memory", () => {
  assert.deepEqual(
    clearTimelineMemoryState(),
    createInitialTimelineMemoryState(),
  );
});
