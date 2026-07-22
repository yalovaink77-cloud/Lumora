import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  LUMORA_MVP_SAFETY_CONTENT,
  LUMORA_MVP_SAFETY_CONTENT_EN,
  LUMORA_MVP_SAFETY_CONTENT_ID,
} from "./mvp-safety-content.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("exports exact content identifier", () => {
  assert.equal(LUMORA_MVP_SAFETY_CONTENT_ID, "lumora.safety.mvp.medical-ai.v1");
  assert.equal(LUMORA_MVP_SAFETY_CONTENT.id, LUMORA_MVP_SAFETY_CONTENT_ID);
  assert.equal(LUMORA_MVP_SAFETY_CONTENT.language, "en");
  assert.equal(LUMORA_MVP_SAFETY_CONTENT.text, LUMORA_MVP_SAFETY_CONTENT_EN);
});

test("preserves every required safety statement", () => {
  const text = LUMORA_MVP_SAFETY_CONTENT_EN;

  assert.match(text, /organize memories and information/i);
  assert.match(text, /does not provide medical advice/i);
  assert.match(text, /diagnosis/i);
  assert.match(text, /treatment/i);
  assert.match(text, /emergency services/i);
  assert.match(text, /provided by users/i);
  assert.match(text, /incomplete or inaccurate/i);
  assert.match(text, /qualified healthcare professional/i);
  assert.match(text, /local emergency services/i);
  assert.match(
    text,
    /no user-facing artificial intelligence features enabled/i,
  );
  assert.match(text, /outputs may be incorrect/i);
  assert.match(text, /must not replace professional judgment/i);
});

test("contains no Family role, emergency number, or consent wording", () => {
  const text = LUMORA_MVP_SAFETY_CONTENT_EN;

  assert.doesNotMatch(text, /\bOWNER\b|\bMEMBER\b|FamilyMembership/);
  assert.doesNotMatch(text, /\b911\b|\b112\b|\b999\b/);
  assert.doesNotMatch(text, /I agree|I understand|consent|accept|checkbox/i);
  assert.doesNotMatch(text, /<[^>]+>/);
});

test("@lumora/shared safety module remains framework-neutral", () => {
  const source = readFileSync(
    join(packageRoot, "src/mvp-safety-content.ts"),
    "utf8",
  );
  const packageJson = readFileSync(join(packageRoot, "package.json"), "utf8");

  assert.doesNotMatch(
    source,
    /\breact-native\b|\bfrom ["']expo|\bAsyncStorage\b|\bSecureStore\b/,
  );
  assert.doesNotMatch(packageJson, /"react-native"|"expo"/);
});
