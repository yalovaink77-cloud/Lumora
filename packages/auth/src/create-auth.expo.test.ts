import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { buildAuthOptions } from "./create-auth.js";
import { InMemoryVerificationEmailCaptureAdapter } from "./verification-delivery.js";

test("buildAuthOptions registers the Better Auth Expo server plugin", () => {
  const options = buildAuthOptions({
    secret: "unit-test-secret-value-with-32-chars-minimum",
    baseUrl: "http://localhost:3000",
    trustedOrigins: ["http://localhost:3000", "lumora://"],
    secureCookies: false,
    delivery: {
      mode: "capture",
      confirmationPageUrl: "http://localhost:3000/verify-email",
      adapter: new InMemoryVerificationEmailCaptureAdapter(),
    },
  });

  assert.equal(Array.isArray(options.plugins), true);
  assert.equal(options.plugins?.length, 2);
  assert.equal(
    options.plugins?.some((plugin) => plugin.id === "expo"),
    true,
  );
});

test("auth package uses @better-auth/expo server plugin without React Native imports", () => {
  const source = readFileSync(
    join(process.cwd(), "src/create-auth.ts"),
    "utf8",
  );
  const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");

  assert.match(source, /from "@better-auth\/expo"/);
  assert.match(source, /expo\(\)/);
  assert.match(packageJson, /"@better-auth\/expo": "1\.6\.23"/);
  assert.doesNotMatch(source, /react-native|expo-secure-store|AsyncStorage/);
});
