import { execFileSync } from "node:child_process";
import { join } from "node:path";

const railway = process.platform === "win32"
  ? join(process.env.APPDATA ?? "", "npm", "railway.cmd")
  : "railway";
const raw = execFileSync(
  railway,
  ["variable", "list", "--service", "@pharmacy/api", "--json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], shell: process.platform === "win32" },
);
const variables = JSON.parse(raw);
const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];
for (const key of required) {
  const value = variables[key];
  const configured = typeof value === "string" ? value.trim().length > 0 : value !== undefined;
  process.stdout.write(`${key}: ${configured ? "configured" : "missing"}\n`);
}

try {
  const supabaseHost = new URL(variables.SUPABASE_URL).hostname;
  process.stdout.write(`SUPABASE_PROJECT_REF: ${supabaseHost.split(".")[0]}\n`);
} catch {
  process.stdout.write("SUPABASE_PROJECT_REF: invalid-url\n");
}
