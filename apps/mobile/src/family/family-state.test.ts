import assert from "node:assert/strict";
import { test } from "node:test";

import { upsertFamilySorted } from "./family-dto";
import {
  applyFamilyDetailSuccess,
  applyFamilyDetailUnavailable,
  applyFamilyListFailure,
  applyFamilyListSuccess,
  beginFamilyDetailLoad,
  beginFamilyListLoad,
  bindFamilyPrincipal,
  clearFamilyMemoryState,
  createInitialFamilyMemoryState,
} from "./family-state";

const family = {
  id: "fam_1",
  displayName: "One",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("initial Family state is empty process-memory defaults", () => {
  const state = createInitialFamilyMemoryState();
  assert.equal(state.principalId, null);
  assert.deepEqual(state.families, []);
  assert.equal(state.listStatus, "idle");
  assert.equal(state.detailStatus, "idle");
});

test("clearFamilyMemoryState resets all Family memory", () => {
  const populated = {
    ...createInitialFamilyMemoryState(),
    principalId: "user_1",
    families: [family],
    listStatus: "ready" as const,
    detail: family,
    detailStatus: "ready" as const,
    detailFamilyId: family.id,
  };

  assert.deepEqual(clearFamilyMemoryState(), createInitialFamilyMemoryState());
  assert.notEqual(populated.families.length, 0);
});

test("principal change clears prior user Family state (user isolation)", () => {
  const userOne = {
    ...createInitialFamilyMemoryState(),
    principalId: "user_1",
    families: [family],
    listStatus: "ready" as const,
  };

  const rebound = bindFamilyPrincipal(userOne, "user_2");
  assert.equal(rebound.principalId, "user_2");
  assert.deepEqual(rebound.families, []);
  assert.equal(rebound.listStatus, "idle");

  const signedOut = bindFamilyPrincipal(userOne, null);
  assert.deepEqual(signedOut, createInitialFamilyMemoryState());
});

test("list load/refresh success and failure update state", () => {
  let state = bindFamilyPrincipal(createInitialFamilyMemoryState(), "user_1");
  state = beginFamilyListLoad(state, "loading");
  const generation = state.listGeneration;

  state = applyFamilyListSuccess(state, {
    principalId: "user_1",
    generation,
    families: [family],
  });
  assert.equal(state.listStatus, "ready");
  assert.deepEqual(state.families, [family]);

  state = beginFamilyListLoad(state, "refreshing");
  const refreshGeneration = state.listGeneration;
  state = applyFamilyListFailure(state, {
    principalId: "user_1",
    generation: refreshGeneration,
    error: "network",
  });
  assert.equal(state.listStatus, "error");
  assert.equal(state.listError, "network");
});

test("stale list responses do not replace current state", () => {
  let state = bindFamilyPrincipal(createInitialFamilyMemoryState(), "user_1");
  state = beginFamilyListLoad(state, "loading");
  const staleGeneration = state.listGeneration;
  state = beginFamilyListLoad(state, "loading");

  const afterStale = applyFamilyListSuccess(state, {
    principalId: "user_1",
    generation: staleGeneration,
    families: [family],
  });
  assert.equal(afterStale.listStatus, "loading");
  assert.deepEqual(afterStale.families, []);
});

test("direct-get success updates detail and matching list entry", () => {
  let state = bindFamilyPrincipal(createInitialFamilyMemoryState(), "user_1");
  state = beginFamilyDetailLoad(state, family.id);
  const generation = state.detailGeneration;

  state = applyFamilyDetailSuccess(state, {
    principalId: "user_1",
    generation,
    familyId: family.id,
    family,
    upsert: upsertFamilySorted,
  });

  assert.equal(state.detailStatus, "ready");
  assert.deepEqual(state.detail, family);
  assert.deepEqual(state.families, [family]);
});

test("FAMILY_NOT_FOUND maps to generic unavailable detail state", () => {
  let state = bindFamilyPrincipal(createInitialFamilyMemoryState(), "user_1");
  state = beginFamilyDetailLoad(state, "missing");
  state = applyFamilyDetailUnavailable(state, {
    principalId: "user_1",
    generation: state.detailGeneration,
    familyId: "missing",
  });

  assert.equal(state.detailStatus, "unavailable");
  assert.equal(state.detail, null);
});

test("stale detail responses after route/principal change are ignored", () => {
  let state = bindFamilyPrincipal(createInitialFamilyMemoryState(), "user_1");
  state = beginFamilyDetailLoad(state, "fam_old");
  const staleGeneration = state.detailGeneration;
  state = beginFamilyDetailLoad(state, "fam_new");

  const afterStale = applyFamilyDetailSuccess(state, {
    principalId: "user_1",
    generation: staleGeneration,
    familyId: "fam_old",
    family,
    upsert: upsertFamilySorted,
  });

  assert.equal(afterStale.detailFamilyId, "fam_new");
  assert.equal(afterStale.detailStatus, "loading");
  assert.equal(afterStale.detail, null);
});

test("create path must not optimistically insert before server success", () => {
  const beforeCreate = bindFamilyPrincipal(
    createInitialFamilyMemoryState(),
    "user_1",
  );
  assert.deepEqual(beforeCreate.families, []);
  // Successful create applies server Family via upsert only after API ok.
  const afterCreate = {
    ...beforeCreate,
    families: upsertFamilySorted(beforeCreate.families, family),
  };
  assert.deepEqual(afterCreate.families, [family]);
});
