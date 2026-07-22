import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const appRoot = process.cwd();

test("disclosure and Safety screens use shared canonical content with a11y labels", () => {
  const disclosure = readFileSync(join(appRoot, "app/disclosure.tsx"), "utf8");
  const safety = readFileSync(join(appRoot, "app/(app)/safety.tsx"), "utf8");
  const home = readFileSync(join(appRoot, "app/(app)/index.tsx"), "utf8");
  const body = readFileSync(
    join(appRoot, "src/safety/SafetyDisclosureBody.tsx"),
    "utf8",
  );

  assert.match(disclosure, /SafetyDisclosureBody/);
  assert.match(disclosure, /Continue to Home/);
  assert.match(disclosure, /ScrollView/);
  assert.match(disclosure, /continueDisclosure/);
  assert.match(disclosure, /Sign out/);
  assert.doesNotMatch(disclosure, /I agree|I understand|checkbox/i);
  assert.doesNotMatch(disclosure, /accessibilityLabel="[^"]*consent/i);

  assert.match(safety, /SafetyDisclosureBody/);
  assert.match(safety, /ScrollView/);
  assert.doesNotMatch(safety, /continueDisclosure/);

  assert.match(home, /\/\(app\)\/safety/);
  assert.match(home, /Safety and Limitations/);

  assert.match(body, /accessibilityLabel/);
  assert.match(body, /LUMORA_MVP_SAFETY_CONTENT/);
  assert.doesNotMatch(body, /AsyncStorage|SecureStore|fetch\(/);
});
