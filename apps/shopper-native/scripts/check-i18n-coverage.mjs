import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * i18n key-coverage gate for shopper-native.
 *
 * Extracts every `t("some.key")` call under app/ and src/, then checks:
 *   1. Every key actually used in code exists in BOTH locale files (a
 *      missing key renders as the literal dotted string on screen — this
 *      exact method surfaced ~100 such gaps during the Phase 0/1
 *      reconstruction audit).
 *   2. en.json and ar.json have the same key set (a key present in one but
 *      not the other means some screen is only reachable in one language).
 *
 * This is a repeatable version of a one-time manual audit, not a new
 * check — see the reconstruction plan's Phase 6.
 */

const baseDir = new URL("../", import.meta.url);
const roots = [new URL("app/", baseDir), new URL("src/", baseDir)];

// Matches the first string-literal argument to any call ending in `t(...)`
// — covers `t("x")`, `i18n.t("x")`, and destructured `const { t } = ...`
// usage, which is how every screen in this app calls into i18next.
const T_CALL = /\bt\(\s*["'`]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)["'`]/g;

async function collectFiles(dir) {
  const out = [];
  const queue = [dir];
  while (queue.length) {
    const current = queue.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const childUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, current);
      if (entry.isDirectory()) {
        queue.push(childUrl);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(childUrl);
      }
    }
  }
  return out;
}

function flatten(obj, prefix = "", out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

// ── Collect used keys ─────────────────────────────────────────────────────

const usedKeys = new Map(); // key -> Set of file paths that use it

for (const root of roots) {
  const files = await collectFiles(root);
  for (const fileUrl of files) {
    const source = await readFile(fileUrl, "utf8");
    for (const match of source.matchAll(T_CALL)) {
      const key = match[1];
      // Skip obvious non-i18n false positives: single-segment keys with no
      // dot are almost always a local variable named `t` used for something
      // else (a timestamp, a transform value) rather than a translation key.
      if (!key.includes(".")) continue;
      if (!usedKeys.has(key)) usedKeys.set(key, new Set());
      usedKeys.get(key).add(fileURLToPath(fileUrl));
    }
  }
}

// ── Load locales ────────────────────────────────────────────────────────

const enUrl = new URL("src/i18n/locales/en.json", baseDir);
const arUrl = new URL("src/i18n/locales/ar.json", baseDir);
const en = JSON.parse(await readFile(enUrl, "utf8"));
const ar = JSON.parse(await readFile(arUrl, "utf8"));
const enKeys = flatten(en);
const arKeys = flatten(ar);

// ── Diff ────────────────────────────────────────────────────────────────

const usedButMissingEn = [...usedKeys.keys()].filter((k) => !enKeys.has(k)).sort();
const usedButMissingAr = [...usedKeys.keys()].filter((k) => !arKeys.has(k)).sort();
const enOnlyKeys = [...enKeys].filter((k) => !arKeys.has(k)).sort();
const arOnlyKeys = [...arKeys].filter((k) => !enKeys.has(k)).sort();

let failed = false;

function report(title, keys, showUsage) {
  if (keys.length === 0) return;
  failed = true;
  console.error(`\n${title} (${keys.length}):`);
  for (const key of keys) {
    if (showUsage) {
      const files = [...(usedKeys.get(key) ?? [])];
      const first = files[0]?.replace(fileURLToPath(baseDir), "");
      const more = files.length > 1 ? ` (+${files.length - 1} more)` : "";
      console.error(`  - ${key}  [${first}${more}]`);
    } else {
      console.error(`  - ${key}`);
    }
  }
}

report("Keys used in code but missing from en.json", usedButMissingEn, true);
report("Keys used in code but missing from ar.json", usedButMissingAr, true);
report("Keys in en.json but not ar.json (screen only reachable in English)", enOnlyKeys, false);
report("Keys in ar.json but not en.json (screen only reachable in Arabic)", arOnlyKeys, false);

if (failed) {
  console.error(`\ni18n coverage check failed. ${usedKeys.size} distinct keys used across the app.`);
  process.exit(1);
}

console.log(`i18n coverage OK — ${usedKeys.size} distinct keys used, all present in both locales; en.json and ar.json key sets match.`);
