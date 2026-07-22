import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { CanonicalEmailAdapter } from "./canonical-email.adapter";
import { NodeInvitationSecretAdapter } from "./node-invitation-secret.adapter";

test("Node invitation secrets have 256-bit entropy shape and SHA-256 digests", async () => {
  const adapter = new NodeInvitationSecretAdapter();
  const first = await adapter.generateSecret();
  const second = await adapter.generateSecret();

  assert.equal(first.length, 43);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);

  const digest = await adapter.digestSecret(first);
  assert.equal(digest.byteLength, 32);
  assert.deepEqual(
    Buffer.from(digest),
    createHash("sha256").update(first, "utf8").digest(),
  );
  assert.notEqual(Buffer.from(digest).toString("utf8"), first);
});

test("canonical email adapter delegates and neutralizes validation failures", () => {
  const inputs: unknown[] = [];
  const adapter = new CanonicalEmailAdapter((input) => {
    inputs.push(input);
    if (input === "invalid") {
      throw new Error("private validator detail");
    }
    return String(input).toLowerCase();
  });

  assert.equal(
    adapter.canonicalizeEmail("Member@Example.test"),
    "member@example.test",
  );
  assert.equal(adapter.canonicalizeEmail("invalid"), null);
  assert.deepEqual(inputs, ["Member@Example.test", "invalid"]);
});
