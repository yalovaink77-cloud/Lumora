import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

for (const nativeDir of ["android", "ios"]) {
  if (existsSync(path.join(appRoot, nativeDir))) {
    throw new Error(
      `Native ${nativeDir}/ directory must not exist in Sprint 2.9B.1.`,
    );
  }
}

const metroConfig = require(path.join(appRoot, "metro.config.js"));
if (!metroConfig?.resolver) {
  throw new Error("Metro configuration failed to load.");
}

const expoConfig = spawnSync(
  "pnpm",
  ["exec", "expo", "config", "--type", "public", "--json"],
  {
    cwd: appRoot,
    encoding: "utf8",
  },
);

if (expoConfig.status !== 0) {
  throw new Error(
    `expo config failed:\n${expoConfig.stdout}\n${expoConfig.stderr}`,
  );
}

let parsed;
try {
  parsed = JSON.parse(expoConfig.stdout);
} catch {
  throw new Error("expo config --json did not return valid JSON.");
}

if (parsed.scheme !== "lumora") {
  throw new Error("Expo config must declare scheme lumora.");
}

if (!Array.isArray(parsed.platforms) || !parsed.platforms.includes("ios")) {
  throw new Error("Expo config must include ios platform.");
}

if (!Array.isArray(parsed.platforms) || !parsed.platforms.includes("android")) {
  throw new Error("Expo config must include android platform.");
}

if (parsed.platforms.includes("web")) {
  throw new Error("Minimum shell must not require Expo web platform.");
}

console.log("Expo foundation verification passed.");
