/**
 * List current user's provider products via /api/provider/products/me.
 *
 * Usage:
 *   pnpm run provider:list
 *   pnpm run provider:list -- --access-token "$SUPABASE_ACCESS_TOKEN"
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env", ".env.local"] as const) {
  const p = resolve(webRoot, name);
  if (existsSync(p)) {
    loadEnv({ path: p, override: name === ".env.local" });
  }
}

type Json = Record<string, unknown>;

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = "true";
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function required(name: string, v: string | undefined): string {
  const s = (v ?? "").trim();
  if (!s) throw new Error(`Missing ${name}`);
  return s;
}

async function main() {
  const args = parseArgs();
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const token = required(
    "--access-token or SUPABASE_ACCESS_TOKEN",
    args["access-token"] ?? process.env.SUPABASE_ACCESS_TOKEN,
  );
  const res = await fetch(`${base}/api/provider/products/me`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as Json;
  if (!res.ok) {
    console.error("Request failed:", res.status);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(json, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
