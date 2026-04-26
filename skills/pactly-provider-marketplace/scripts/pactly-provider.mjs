#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const webRoot = resolve(repoRoot, "web");

loadEnvFiles([
  resolve(webRoot, ".env"),
  resolve(webRoot, ".env.local"),
  resolve(repoRoot, ".env"),
  resolve(repoRoot, ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
]);

const COMMANDS = new Set(["marketplace-health", "validate-agent", "publish", "validate-and-publish", "help"]);

function usage() {
  return `Pactly provider marketplace wrapper

Usage:
  node pactly-provider.mjs marketplace-health
  node pactly-provider.mjs validate-agent --base-url <agent-origin> [--invoke-path /invoke] [--input-json '{...}']
  node pactly-provider.mjs publish --linked-service-id <id> --title <text> --description <text> --base-url <agent-origin>
  node pactly-provider.mjs validate-and-publish --linked-service-id <id> --title <text> --description <text> --base-url <agent-origin>

Auth:
  User mode:     --access-token <supabase-jwt> or SUPABASE_ACCESS_TOKEN
  Operator mode: --owner-user-id <id> plus --agent-key <key> or AGENT_API_KEY

Env:
  PACTLY_BASE_URL or NEXT_PUBLIC_BASE_URL
  PACTLY_SUPABASE_ACCESS_TOKEN or SUPABASE_ACCESS_TOKEN
  PACTLY_AGENT_API_KEY or AGENT_API_KEY
`;
}

function loadEnvFiles(paths) {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, valueRaw] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = unquote(valueRaw.trim());
    }
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
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

function marketplaceUrl(args) {
  return String(
    args["marketplace-url"] ??
      args["base-marketplace-url"] ??
      process.env.PACTLY_BASE_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "http://localhost:3000",
  ).replace(/\/+$/, "");
}

function required(name, value) {
  const s = value === undefined || value === null ? "" : String(value).trim();
  if (!s) throw new Error(`Missing required ${name}.`);
  return s;
}

function numberArg(name, value, fallback, options = {}) {
  const raw = value === undefined || value === "" ? fallback : value;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number.`);
  if (options.min !== undefined && n < options.min) throw new Error(`${name} must be >= ${options.min}.`);
  if (options.max !== undefined && n > options.max) throw new Error(`${name} must be <= ${options.max}.`);
  return n;
}

function jsonArg(name, value, fallback = {}) {
  if (value === undefined || value === "") return fallback;
  if (String(value) === "-") {
    value = readFileSync(0, "utf8");
  } else if (String(value).startsWith("@")) {
    value = readFileSync(resolve(process.cwd(), String(value).slice(1)), "utf8");
  }
  try {
    const parsed = JSON.parse(String(value));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON must be an object.");
    }
    return parsed;
  } catch (error) {
    throw new Error(`${name} must be a JSON object: ${error.message}`);
  }
}

function agentOrigin(args) {
  return required("--base-url", args["agent-base-url"] ?? args["base-url"]).replace(/\/+$/, "");
}

function invokePath(args) {
  const raw = String(args["invoke-path"] ?? "/invoke").trim() || "/invoke";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function headersArg(args) {
  const headers = jsonArg("--headers-json", args["headers-json"], {});
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== "string") {
      throw new Error(`headers-json value for ${key} must be a string.`);
    }
  }
  return headers;
}

async function readJsonResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function requestJson(method, url, body, headers = {}) {
  const reqHeaders = { ...headers };
  if (body !== undefined) reqHeaders["content-type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await readJsonResponse(res);
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${method} ${url}`);
    error.status = res.status;
    error.body = json;
    throw error;
  }
  return json;
}

async function validateAgent(args) {
  const origin = agentOrigin(args);
  const path = invokePath(args);
  const headers = headersArg(args);
  const healthUrl = `${origin}/health`;
  const invokeUrl = new URL(path, `${origin}/`).toString();

  let health = null;
  try {
    health = await requestJson("GET", healthUrl, undefined, headers);
  } catch (error) {
    throw new Error(`Agent health check failed at ${healthUrl}: ${error.message}`);
  }

  const task = String(args.task ?? "Pactly provider validation");
  const input = jsonArg("--input-json", args["input-json"], { message: "hello from Pactly provider validation" });
  const body = {
    task,
    input,
    service_contract: String(args["service-contract"] ?? args["linked-service-id"] ?? "provider_validation"),
  };

  const invoke = await requestJson("POST", invokeUrl, body, headers);
  if (typeof invoke?.success !== "boolean") {
    throw new Error("Agent invoke response must include boolean field `success`.");
  }
  if (!invoke.success) {
    throw new Error(`Agent invoke reported failure: ${JSON.stringify(invoke)}`);
  }
  if (invoke.output === undefined) {
    throw new Error("Agent invoke response must include `output`.");
  }

  return {
    ok: true,
    health,
    invoke,
    endpoint: {
      base_url: origin,
      invoke_path: path,
    },
  };
}

function publishBody(args) {
  const body = {
    title: required("--title", args.title),
    description: required("--description", args.description),
    type: String(args.type ?? "agent"),
    price_sats: numberArg("--price-sats", args["price-sats"], 100, { min: 0 }),
    linked_service_id: required("--linked-service-id", args["linked-service-id"]),
    base_url: agentOrigin(args),
    invoke_path: invokePath(args),
  };
  const headers = headersArg(args);
  if (Object.keys(headers).length > 0) body.headers = headers;
  return body;
}

async function publish(args) {
  const accessToken = String(
    args["access-token"] ??
      process.env.PACTLY_SUPABASE_ACCESS_TOKEN ??
      process.env.SUPABASE_ACCESS_TOKEN ??
      "",
  ).trim();

  const body = publishBody(args);
  if (accessToken) {
    return requestJson("POST", `${marketplaceUrl(args)}/api/provider/products/me`, body, {
      authorization: `Bearer ${accessToken}`,
    });
  }

  const agentKey = String(args["agent-key"] ?? process.env.PACTLY_AGENT_API_KEY ?? process.env.AGENT_API_KEY ?? "").trim();
  const ownerUserId = required("--owner-user-id", args["owner-user-id"]);
  body.owner_user_id = ownerUserId;
  return requestJson("POST", `${marketplaceUrl(args)}/api/provider/products`, body, {
    "x-api-key": required("--agent-key or AGENT_API_KEY", agentKey),
  });
}

function print(data, compact) {
  console.log(JSON.stringify(data, null, compact ? 0 : 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? "help";
  if (!COMMANDS.has(command)) throw new Error(`Unknown command "${command}".\n${usage()}`);
  if (command === "help") {
    console.log(usage());
    return;
  }

  let output;
  if (command === "marketplace-health") {
    output = await requestJson("GET", `${marketplaceUrl(args)}/api/health`);
  } else if (command === "validate-agent") {
    output = await validateAgent(args);
  } else if (command === "publish") {
    output = await publish(args);
  } else if (command === "validate-and-publish") {
    const validation = await validateAgent(args);
    const published = await publish(args);
    output = { validation, published };
  }
  print(output, args.json === "true");
}

main().catch((error) => {
  console.error(error.message);
  if (error.body) console.error(JSON.stringify(error.body, null, 2));
  process.exit(1);
});
