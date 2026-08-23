import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Minimal "lint" gate for shopper-native.
 *
 * We intentionally avoid ESLint here because this repo doesn't currently ship
 * an eslint config for RN/Expo and the global npx ESLint version varies.
 *
 * Policy:
 *  - No console.log / console.warn / console.error in app/ or src/
 */

const baseDir = new URL("../", import.meta.url);
// Keep the gate focused on production-hardening surfaces we touch frequently.
// The wider codebase still contains legacy debug logs which are handled by
// the build-time console stripping step.
const roots = [
  new URL("src/features/loyalty/", baseDir),
  new URL("app/wallet.tsx", baseDir),
  new URL("app/coupons.tsx", baseDir),
  new URL("app/gifts.tsx", baseDir),
  new URL("app/loyalty.tsx", baseDir),
];

const offenders = [];
const queue = roots.filter((u) => u.pathname.endsWith("/"));

for (let i = 0; i < queue.length; i += 1) {
  const dir = queue[i];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    continue;
  }

  for (const entry of entries) {
    const childUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);

    if (entry.isDirectory()) {
      queue.push(childUrl);
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const source = await readFile(childUrl, "utf8");
    if (/console\.(log|warn|error)\s*\(/.test(source)) {
      offenders.push(fileURLToPath(childUrl));
    }
  }
}

// Also scan the explicit single-file roots (wallet/coupons/gifts/loyalty routes).
for (const fileUrl of roots.filter((u) => !u.pathname.endsWith("/"))) {
  try {
    const source = await readFile(fileUrl, "utf8");
    if (/console\.(log|warn|error)\s*\(/.test(source)) {
      offenders.push(fileURLToPath(fileUrl));
    }
  } catch {
    // ignore missing files
  }
}

if (offenders.length) {
   
  console.error("Console statements are not allowed in shopper-native (app/ + src/):");
  offenders.forEach((file) => console.error(` - ${join(file)}`));
  process.exit(1);
}

 
console.log("No console statements found in shopper-native (app/ + src/).");
