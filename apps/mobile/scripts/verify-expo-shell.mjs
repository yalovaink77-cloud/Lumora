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
      `Native ${nativeDir}/ directory must not exist for the Expo Go shell.`,
    );
  }
}

const requiredRoutes = [
  "app/_layout.tsx",
  "app/index.tsx",
  "app/(auth)/_layout.tsx",
  "app/(auth)/sign-in.tsx",
  "app/(auth)/register.tsx",
  "app/disclosure.tsx",
  "app/(app)/_layout.tsx",
  "app/(app)/index.tsx",
  "app/(app)/safety.tsx",
];

for (const route of requiredRoutes) {
  if (!existsSync(path.join(appRoot, route))) {
    throw new Error(`Missing required Expo Router file: ${route}`);
  }
}

const metroConfig = require(path.join(appRoot, "metro.config.js"));
if (!metroConfig?.resolver) {
  throw new Error("Metro configuration failed to load.");
}

const packageJson = require(path.join(appRoot, "package.json"));
if (packageJson.main !== "expo-router/entry") {
  throw new Error('package.json main must be "expo-router/entry".');
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

const plugins = parsed.plugins ?? [];
const pluginNames = plugins.map((plugin) =>
  Array.isArray(plugin) ? plugin[0] : plugin,
);

if (!pluginNames.includes("expo-router")) {
  throw new Error("Expo config must include expo-router plugin.");
}

console.log("Expo authenticated shell verification passed.");
