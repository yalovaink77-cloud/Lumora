import assert from "node:assert/strict";
import { test } from "node:test";

import {
  continueDisclosureForPrincipal,
  createInitialDisclosureProcessState,
  hasContinuedDisclosure,
  resetDisclosureProcessState,
} from "./disclosure-process-state";

test("disclosure continuation begins false and is principal-scoped", () => {
  const initial = createInitialDisclosureProcessState();
  assert.equal(initial.continuedForPrincipalId, null);
  assert.equal(hasContinuedDisclosure(initial, "user_1"), false);

  const continued = continueDisclosureForPrincipal("user_1");
  assert.equal(hasContinuedDisclosure(continued, "user_1"), true);
  assert.equal(hasContinuedDisclosure(continued, "user_2"), false);
});

test("sign-out and principal change reset continuation in memory only", () => {
  const continued = continueDisclosureForPrincipal("user_1");
  assert.deepEqual(resetDisclosureProcessState(), {
    continuedForPrincipalId: null,
  });
  assert.equal(hasContinuedDisclosure(continued, "user_2"), false);
});
