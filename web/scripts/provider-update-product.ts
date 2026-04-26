/**
 * Update one provider product via PATCH /api/provider/products/me.
 *
 * Usage:
 *   pnpm run provider:update -- \
 *     --product-id <uuid> \
 *     --title "New title" \
 *     --price-sats 120
 *
 * Optional fields: description, linked-service-id, base-url, invoke-path, type, headers-json, active.
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
  const productId = required("--product-id", args["product-id"]);

  let headers: Record<string, string> | undefined;
  const headersJson = (args["headers-json"] ?? "").trim();
  if (headersJson) {
    const parsed = JSON.parse(headersJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("--headers-json must be a JSON object");
    }
    headers = parsed as Record<string, string>;
  }

  const body: Json = { product_id: productId };
  if (args.title) body.title = args.title;
  if (args.description) body.description = args.description;
  if (args.type) body.type = args.type;
  if (args["linked-service-id"]) body.linked_service_id = args["linked-service-id"];
  if (args["base-url"]) body.base_url = args["base-url"];
  if (args["invoke-path"]) body.invoke_path = args["invoke-path"];
  if (args["price-sats"]) {
    const n = Number(args["price-sats"]);
    if (!Number.isFinite(n)) throw new Error("--price-sats must be a number");
    body.price_sats = n;
  }
  if (args.active === "0" || args.active === "1") {
    body.active = Number(args.active);
  }
  if (headers && Object.keys(headers).length > 0) body.headers = headers;

  const res = await fetch(`${base}/api/provider/products/me`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
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
