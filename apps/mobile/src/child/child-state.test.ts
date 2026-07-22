import assert from "node:assert/strict";
import { test } from "node:test";

import { upsertChildSorted } from "./child-dto";
import {
  applyChildDetailSuccess,
  applyChildDetailUnavailable,
  applyChildDisplayNameUpdate,
  applyChildListFailure,
  applyChildListSuccess,
  applyChildListUnavailable,
  beginChildDetailLoad,
  beginChildListLoad,
  bindChildFamilyContext,
  bindChildPrincipal,
  clearChildMemoryState,
  createInitialChildMemoryState,
} from "./child-state";

const child = {
  id: "child_1",
  familyId: "fam_1",
  displayName: "One",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("initial Child state is empty process-memory defaults", () => {
  const state = createInitialChildMemoryState();
  assert.equal(state.principalId, null);
  assert.equal(state.familyId, null);
  assert.deepEqual(state.children, []);
});

test("principal change clears prior Child state", () => {
  const userOne = {
    ...createInitialChildMemoryState(),
    principalId: "user_1",
    familyId: "fam_1",
    children: [child],
    listStatus: "ready" as const,
  };

  assert.deepEqual(bindChildPrincipal(userOne, "user_2").children, []);
  assert.deepEqual(
    bindChildPrincipal(userOne, null),
    createInitialChildMemoryState(),
  );
});

test("Family context change isolates Child state", () => {
  const famOne = {
    ...createInitialChildMemoryState(),
    principalId: "user_1",
    familyId: "fam_1",
    children: [child],
    listStatus: "ready" as const,
  };

  const famTwo = bindChildFamilyContext(famOne, "fam_2");
  assert.equal(famTwo.familyId, "fam_2");
  assert.deepEqual(famTwo.children, []);
  assert.equal(famTwo.principalId, "user_1");
});

test("list success, refresh failure, and FAMILY_NOT_FOUND unavailable", () => {
  let state = bindChildPrincipal(createInitialChildMemoryState(), "user_1");
  state = beginChildListLoad(state, "fam_1", "loading");
  const generation = state.listGeneration;

  state = applyChildListSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation,
    children: [child],
  });
  assert.equal(state.listStatus, "ready");

  state = beginChildListLoad(state, "fam_1", "refreshing");
  state = applyChildListFailure(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.listGeneration,
    error: "network",
  });
  assert.equal(state.listStatus, "error");

  state = beginChildListLoad(state, "fam_1", "loading");
  state = applyChildListUnavailable(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.listGeneration,
  });
  assert.equal(state.listStatus, "unavailable");
  assert.deepEqual(state.children, []);
});

test("stale list responses for another Family or generation are ignored", () => {
  let state = bindChildPrincipal(createInitialChildMemoryState(), "user_1");
  state = beginChildListLoad(state, "fam_1", "loading");
  const staleGeneration = state.listGeneration;
  state = beginChildListLoad(state, "fam_2", "loading");

  const afterStale = applyChildListSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: staleGeneration,
    children: [child],
  });
  assert.equal(afterStale.familyId, "fam_2");
  assert.deepEqual(afterStale.children, []);
});

test("direct-get success updates detail and matching scoped list", () => {
  let state = bindChildPrincipal(createInitialChildMemoryState(), "user_1");
  state = beginChildDetailLoad(state, "fam_1", child.id);
  state = applyChildDetailSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.detailGeneration,
    childId: child.id,
    child,
    upsert: upsertChildSorted,
  });

  assert.equal(state.detailStatus, "ready");
  assert.deepEqual(state.detail, child);
  assert.deepEqual(state.children, [child]);
});

test("CHILD_NOT_FOUND maps to generic unavailable detail", () => {
  let state = bindChildPrincipal(createInitialChildMemoryState(), "user_1");
  state = beginChildDetailLoad(state, "fam_1", "missing");
  state = applyChildDetailUnavailable(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.detailGeneration,
    childId: "missing",
  });
  assert.equal(state.detailStatus, "unavailable");
  assert.equal(state.detail, null);
});

test("displayName update synchronizes list/detail and refreshes updatedAt", () => {
  let state = bindChildPrincipal(createInitialChildMemoryState(), "user_1");
  state = beginChildListLoad(state, "fam_1", "loading");
  state = applyChildListSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.listGeneration,
    children: [child],
  });
  state = beginChildDetailLoad(state, "fam_1", child.id);
  state = applyChildDetailSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.detailGeneration,
    childId: child.id,
    child,
    upsert: upsertChildSorted,
  });

  const renamed = {
    ...child,
    displayName: "One",
    updatedAt: "2026-01-03T00:00:00.000Z",
  };

  state = applyChildDisplayNameUpdate(state, {
    principalId: "user_1",
    familyId: "fam_1",
    childId: child.id,
    child: renamed,
    upsert: upsertChildSorted,
  });

  assert.equal(state.detail?.updatedAt, "2026-01-03T00:00:00.000Z");
  assert.equal(state.children[0]?.updatedAt, "2026-01-03T00:00:00.000Z");
  assert.equal(state.detail?.displayName, "One");
});

test("displayName update for another Family context is ignored", () => {
  let state = bindChildPrincipal(createInitialChildMemoryState(), "user_1");
  state = beginChildListLoad(state, "fam_1", "loading");
  state = applyChildListSuccess(state, {
    principalId: "user_1",
    familyId: "fam_1",
    generation: state.listGeneration,
    children: [child],
  });

  const ignored = applyChildDisplayNameUpdate(state, {
    principalId: "user_1",
    familyId: "fam_2",
    childId: child.id,
    child: { ...child, familyId: "fam_2", displayName: "Other" },
    upsert: upsertChildSorted,
  });

  assert.deepEqual(ignored.children, [child]);
});

test("clearChildMemoryState resets all Child memory", () => {
  assert.deepEqual(clearChildMemoryState(), createInitialChildMemoryState());
});

test("create path must not optimistically insert before server success", () => {
  const before = bindChildPrincipal(createInitialChildMemoryState(), "user_1");
  assert.deepEqual(before.children, []);
  const after = {
    ...before,
    children: upsertChildSorted(before.children, child),
  };
  assert.deepEqual(after.children, [child]);
});
