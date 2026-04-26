/**
 * Publish a marketplace listing for an HTTP (http_external) agent.
 *
 * **User / agent mode (no shared server secret):**
 *   Set SUPABASE_ACCESS_TOKEN (or pass --access-token) to the user's JWT from Supabase Auth.
 *   POSTs to `/api/provider/products/me` — auto-creates a provider account if needed.
 *
 *   pnpm run provider:publish -- \
 *     --access-token "$SUPABASE_ACCESS_TOKEN" \
 *     --linked-service-id my_agent_v1 \
 *     --title "My agent" \
 *     --description "Does X" \
 *     --base-url https://your-service.onrender.com
 *
 * **Operator mode (AGENT_API_KEY on server):**
 *   pnpm run provider:publish -- \
 *     --owner-user-id <supabase_user_uuid> \
 *     --linked-service-id my_agent_v1 \
 *     --title "My agent" \
 *     --description "Does X" \
 *     --base-url https://your-service.onrender.com
 *
 * Optional: --price-sats 100 --type agent --invoke-path /invoke --headers-json '{"X-Custom":"v"}'
 *
 * Env: NEXT_PUBLIC_BASE_URL, and either SUPABASE_ACCESS_TOKEN or AGENT_API_KEY (+ --owner-user-id).
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
    if (!next || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function required(flag: string, v: string | undefined): string {
  const s = (v ?? "").trim();
  if (!s) {
    throw new Error(`Missing required --${flag} (or empty value).`);
  }
  return s;
}

async function main() {
  const args = parseArgs();
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const linkedServiceId = required("linked-service-id", args["linked-service-id"]);
  const title = required("title", args.title);
  const description = required("description", args.description);
  const baseUrl = required("base-url", args["base-url"]);

  const priceSats = args["price-sats"] ? Number(args["price-sats"]) : 100;
  const type = (args.type ?? "agent").trim();
  const invokePath = (args["invoke-path"] ?? "/invoke").trim() || "/invoke";

  let headers: Record<string, string> | undefined;
  const hj = (args["headers-json"] ?? "").trim();
  if (hj) {
    const parsed = JSON.parse(hj) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("--headers-json must be a JSON object");
    }
    headers = parsed as Record<string, string>;
  }

  const accessToken = (args["access-token"] ?? process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
  const useUserAuth = Boolean(accessToken);

  let url: string;
  let reqHeaders: Record<string, string>;
  let body: Json;

  if (useUserAuth) {
    url = `${base}/api/provider/products/me`;
    reqHeaders = {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    };
    body = {
      title,
      description,
      type,
      linked_service_id: linkedServiceId,
      base_url: baseUrl,
      invoke_path: invokePath,
      price_sats: Number.isFinite(priceSats) ? priceSats : 100,
    };
  } else {
    const key = required("env AGENT_API_KEY", process.env.AGENT_API_KEY);
    const ownerUserId = required("owner-user-id", args["owner-user-id"]);
    url = `${base}/api/provider/products`;
    reqHeaders = {
      "content-type": "application/json",
      "x-api-key": key,
    };
    body = {
      owner_user_id: ownerUserId,
      title,
      description,
      type,
      linked_service_id: linkedServiceId,
      base_url: baseUrl,
      invoke_path: invokePath,
      price_sats: Number.isFinite(priceSats) ? priceSats : 100,
    };
  }

  if (headers && Object.keys(headers).length > 0) {
    body.headers = headers;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: reqHeaders,
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as Json;
  if (!res.ok) {
    console.error("Request failed:", res.status);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  console.log("Published:");
  console.log(JSON.stringify(json, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
