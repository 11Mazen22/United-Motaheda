import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../apps/shopper-web/src/", import.meta.url);
const queue = [root];
const offenders = [];

for (let index = 0; index < queue.length; index += 1) {
  const entry = queue[index];
  const { readdir } = await import("node:fs/promises");
  const children = await readdir(entry, { withFileTypes: true });

  for (const child of children) {
    const childUrl = new URL(`${child.name}${child.isDirectory() ? "/" : ""}`, entry);

    if (child.isDirectory()) {
      queue.push(childUrl);
      continue;
    }

    if (!/\.(ts|tsx)$/.test(child.name)) {
      continue;
    }

    const source = await readFile(childUrl, "utf8");

    if (/console\.(log|warn|error)\s*\(/.test(source)) {
      offenders.push(join(childUrl.pathname));
    }
  }
}

if (offenders.length) {
  console.error("Console statements are not allowed in src:");
  offenders.forEach((file) => console.error(` - ${file}`));
  process.exit(1);
}

console.log("No console statements found in src.");
