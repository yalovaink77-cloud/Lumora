import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAMILY_MEMBER_ROLE,
  FAMILY_MEMBERSHIP_ROLES,
  FAMILY_OWNER_ROLE,
} from "./family.types";

test("Family membership vocabulary is exactly OWNER and MEMBER", () => {
  assert.deepEqual(FAMILY_MEMBERSHIP_ROLES, [
    FAMILY_OWNER_ROLE,
    FAMILY_MEMBER_ROLE,
  ]);
  assert.deepEqual(FAMILY_MEMBERSHIP_ROLES, ["OWNER", "MEMBER"]);
});
