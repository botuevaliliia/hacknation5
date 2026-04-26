/**
 * Log in a provider user from CLI and obtain a Supabase access token.
 *
 * Usage:
 *   pnpm run provider:login -- --email you@example.com --password '...'
 *   pnpm run provider:login -- --email you@example.com --password '...' --write-env
 *
 * `--write-env` updates/creates SUPABASE_ACCESS_TOKEN in web/.env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env", ".env.local"] as const) {
  const p = resolve(webRoot, name);
  if (existsSync(p)) {
    loadEnv({ path: p, override: name === ".env.local" });
  }
}

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
  if (!s) throw new Error(`Missing --${name}`);
  return s;
}

function upsertEnvVar(filePath: string, key: string, value: string) {
  const escaped = value.replace(/\n/g, "");
  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${key}=${escaped}\n`, "utf8");
    return;
  }
  const old = readFileSync(filePath, "utf8");
  const lines = old.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${escaped}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${escaped}`);
  writeFileSync(filePath, `${next.join("\n").replace(/\n+$/g, "")}\n`, "utf8");
}

async function main() {
  const args = parseArgs();
  const email = required("email", args.email);
  const password = required("password", args.password);
  const writeEnv = args["write-env"] === "true";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message || "Login failed");
  }
  const accessToken = data.session.access_token;
  console.log(JSON.stringify({ ok: true, user_id: data.user.id, access_token: accessToken }, null, 2));
  if (writeEnv) {
    upsertEnvVar(resolve(webRoot, ".env.local"), "SUPABASE_ACCESS_TOKEN", accessToken);
    console.log("Updated web/.env.local with SUPABASE_ACCESS_TOKEN");
  } else {
    console.log("Tip: pass --write-env to save SUPABASE_ACCESS_TOKEN in web/.env.local");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
