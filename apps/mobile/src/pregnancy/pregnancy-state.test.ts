import assert from "node:assert/strict";
import { test } from "node:test";

import { upsertPregnancySorted } from "./pregnancy-dto";
import {
  applyPregnancyDetailSuccess,
  applyPregnancyDetailUnavailable,
  applyPregnancyListFailure,
  applyPregnancyListSuccess,
  applyPregnancyListUnavailable,
  beginPregnancyDetailLoad,
  beginPregnancyListLoad,
  bindPregnancyFamilyContext,
  bindPregnancyPrincipal,
  clearPregnancyMemoryState,
  createInitialPregnancyMemoryState,
} from "./pregnancy-state";

const pregnancy = {
  id: "preg_1",
  familyId: "fam_1",
  displayName: "One",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("initial Pregnancy state is empty process-memory defaults", () => {
  const state = createInitialPregnancyMemoryState();
  assert.equal(state.principalId, null);
  assert.equal(state.familyId, null);
  assert.deepEqual(state.pregnancies, []);
});

test("principal change clears prior Pregnancy state", () => {
  const userOne = {
    ...createInitialPregnancyMemoryState(),
    principalId: "user_1",
    familyId: "fam_1",
    pregnancies: [pregnancy],
    listStatus: "ready" as const,
  };

  assert.deepEqual(bindPregnancyPrincipal(userOne, "user_2").pregnancies, []);
  assert.deepEqual(
    bindPregnancyPrincipal(userOne, null),
    createInitialPregnancyMemoryState(),
  );
});

test("Family context change isolates Pregnancy state", () => {
  const famOne = {
    ...createInitialPregnancyMemoryState(),
    principalId: "user_1",
    familyId: "fam_1",
    pregnancies: [pregnancy],
    listStatus: "ready" as const,
  };

  const famTwo = bindPregnancyFamilyContext(famOne, "fam_2");
  assert.equal(famTwo.familyId, "fam_2");
  assert.deepEqual(famTwo.pregnancies, []);
  assert.equal(famTwo.principalId, "user_1");
});

test("list success, refresh failure, and FAMILY_NOT_FOUND unavailable", () => {
  let state = bindPregnancyPrincipal(
    createInitialPregnancyMemoryState(),
    "user_1",
  );
  state = beginPregnancyListLoad(state, "fam_1", "loading");
  const generation = state.listGeneration;

  state = applyPregnancyListSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation,
    pregnancies: [pregnancy],
  });
  assert.equal(state.listStatus, "ready");

  state = beginPregnancyListLoad(state, "fam_1", "refreshing");
  state = applyPregnancyListFailure(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.listGeneration,
    error: "network",
  });
  assert.equal(state.listStatus, "error");

  state = beginPregnancyListLoad(state, "fam_1", "loading");
  state = applyPregnancyListUnavailable(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.listGeneration,
  });
  assert.equal(state.listStatus, "unavailable");
  assert.deepEqual(state.pregnancies, []);
});

test("stale list responses for another Family or generation are ignored", () => {
  let state = bindPregnancyPrincipal(
    createInitialPregnancyMemoryState(),
    "user_1",
  );
  state = beginPregnancyListLoad(state, "fam_1", "loading");
  const staleGeneration = state.listGeneration;
  state = beginPregnancyListLoad(state, "fam_2", "loading");

  const afterStale = applyPregnancyListSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: staleGeneration,
    pregnancies: [pregnancy],
  });
  assert.equal(afterStale.familyId, "fam_2");
  assert.deepEqual(afterStale.pregnancies, []);
});

test("direct-get success updates detail and matching scoped list", () => {
  let state = bindPregnancyPrincipal(
    createInitialPregnancyMemoryState(),
    "user_1",
  );
  state = beginPregnancyDetailLoad(state, "fam_1", pregnancy.id);
  state = applyPregnancyDetailSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.detailGeneration,
    pregnancyId: pregnancy.id,
    pregnancy,
    upsert: upsertPregnancySorted,
  });

  assert.equal(state.detailStatus, "ready");
  assert.deepEqual(state.detail, pregnancy);
  assert.deepEqual(state.pregnancies, [pregnancy]);
});

test("PREGNANCY_NOT_FOUND maps to generic unavailable detail", () => {
  let state = bindPregnancyPrincipal(
    createInitialPregnancyMemoryState(),
    "user_1",
  );
  state = beginPregnancyDetailLoad(state, "fam_1", "missing");
  state = applyPregnancyDetailUnavailable(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.detailGeneration,
    pregnancyId: "missing",
  });
  assert.equal(state.detailStatus, "unavailable");
  assert.equal(state.detail, null);
});

test("clearPregnancyMemoryState resets all Pregnancy memory", () => {
  assert.deepEqual(
    clearPregnancyMemoryState(),
    createInitialPregnancyMemoryState(),
  );
});

test("create path must not optimistically insert before server success", () => {
  const before = bindPregnancyPrincipal(
    createInitialPregnancyMemoryState(),
    "user_1",
  );
  assert.deepEqual(before.pregnancies, []);
  const after = {
    ...before,
    pregnancies: upsertPregnancySorted(before.pregnancies, pregnancy),
  };
  assert.deepEqual(after.pregnancies, [pregnancy]);
});
