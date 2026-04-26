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

const COMMANDS = new Set(["discover", "invoke", "feedback", "run", "summary", "help"]);

function usage() {
  return `Pactly customer marketplace wrapper

Usage:
  node pactly-customer.mjs discover --task <text> --budget-usd <n> [--capability <name>]
  node pactly-customer.mjs invoke --service-id <id> --agent-id <id> --task <text> --budget-usd <n> --input-json '{...}'
  node pactly-customer.mjs feedback --transaction-id <id> --quality-score <0..1> [--task-success true]
  node pactly-customer.mjs run --task <text> --budget-usd <n> [--capability <name>] [--input-json '{...}']
  node pactly-customer.mjs summary

Env:
  PACTLY_BASE_URL or NEXT_PUBLIC_BASE_URL
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

function baseUrl(args) {
  return String(
    args["base-url"] ??
      process.env.PACTLY_BASE_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "http://localhost:3000",
  ).replace(/\/+$/, "");
}

function agentKey(args) {
  return String(args["agent-key"] ?? process.env.PACTLY_AGENT_API_KEY ?? process.env.AGENT_API_KEY ?? "").trim();
}

function required(name, value) {
  const s = value === undefined || value === null ? "" : String(value).trim();
  if (!s) throw new Error(`Missing required ${name}.`);
  return s;
}

function numberArg(name, value, options = {}) {
  const n = Number(required(name, value));
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number.`);
  if (options.min !== undefined && n < options.min) throw new Error(`${name} must be >= ${options.min}.`);
  if (options.max !== undefined && n > options.max) throw new Error(`${name} must be <= ${options.max}.`);
  return n;
}

function boolArg(value, fallback) {
  if (value === undefined) return fallback;
  const s = String(value).toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  throw new Error(`Expected boolean, got ${value}`);
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

async function request(args, method, path, body, { auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) {
    const key = required("agent key (--agent-key or AGENT_API_KEY)", agentKey(args));
    headers["x-api-key"] = key;
  }
  const url = `${baseUrl(args)}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${method} ${path}`);
    error.status = res.status;
    error.body = json;
    throw error;
  }
  return json;
}

function discoverBody(args) {
  const task = required("--task", args.task);
  const budget = numberArg("--budget-usd", args["budget-usd"], { min: 0.000001 });
  const body = {
    task,
    budget_usd: budget,
    ranker_mode: args["ranker-mode"] === "weighted" ? "weighted" : "synthetic_ltr",
  };
  const capability = String(args.capability ?? args["required-capability"] ?? "").trim();
  if (capability) body.required_capability = capability;
  return body;
}

function invokeBody(args, serviceId, rankingEventId, adapterType) {
  const task = required("--task", args.task);
  const resolvedRankingEventId = rankingEventId ?? args["ranking-event-id"];
  return {
    service_id: required("--service-id", serviceId ?? args["service-id"]),
    agent_id: String(args["agent-id"] ?? "openclaw-customer-agent").trim() || "openclaw-customer-agent",
    task,
    budget_usd: numberArg("--budget-usd", args["budget-usd"], { min: 0.000001 }),
    input: args["input-json"] ? jsonArg("--input-json", args["input-json"]) : defaultInput(adapterType, task),
    ...(resolvedRankingEventId ? { ranking_event_id: resolvedRankingEventId } : {}),
  };
}

function feedbackBody(args, transactionId) {
  return {
    transaction_id: required("--transaction-id", transactionId ?? args["transaction-id"]),
    quality_score: numberArg("--quality-score", args["quality-score"], { min: 0, max: 1 }),
    task_success: boolArg(args["task-success"], true),
    result_useful: boolArg(args["result-useful"], true),
    price_fair: boolArg(args["price-fair"], true),
    latency_ok: boolArg(args["latency-ok"], true),
    would_use_again: boolArg(args["would-use-again"], true),
    ...(args.note ? { freeform_note: String(args.note) } : {}),
  };
}

function defaultInput(adapterType, task) {
  switch (adapterType) {
    case "openrouter":
      return { prompt: task };
    case "tavily":
    case "exa":
    case "serper":
      return { query: task };
    case "http_external":
      return { task };
    case "firecrawl":
      throw new Error('firecrawl requires --input-json, for example {"url":"https://example.com"}');
    default:
      return { query: task };
  }
}

function selectResult(discoverJson, preferredServiceId) {
  const results = Array.isArray(discoverJson?.results) ? discoverJson.results : [];
  if (results.length === 0) throw new Error("Discover returned no eligible services.");
  if (preferredServiceId) {
    const found = results.find(
      (r) => String(r.service_id ?? r.serviceId ?? "") === preferredServiceId,
    );
    if (!found) throw new Error(`Preferred service ${preferredServiceId} was not in discover results.`);
    return found;
  }
  return results[0];
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
  if (command === "discover") {
    output = await request(args, "POST", "/api/v1/discover", discoverBody(args));
  } else if (command === "invoke") {
    output = await request(args, "POST", "/api/v1/invoke", invokeBody(args));
  } else if (command === "feedback") {
    output = await request(args, "POST", "/api/v1/feedback", feedbackBody(args));
  } else if (command === "summary") {
    output = await request(args, "GET", "/api/v1/observability/summary", undefined, { auth: false });
  } else if (command === "run") {
    const discover = await request(args, "POST", "/api/v1/discover", discoverBody(args));
    const selected = selectResult(discover, args["service-id"]);
    const serviceId = String(selected.service_id ?? selected.serviceId ?? "");
    const adapterType = String(selected.adapterType ?? selected.adapter_type ?? "");
    const invoke = await request(
      args,
      "POST",
      "/api/v1/invoke",
      invokeBody(args, serviceId, discover.ranking_event_id, adapterType),
    );
    const transactionId = String(invoke?.transaction_id ?? "");
    if (!transactionId) throw new Error("Invoke succeeded but did not return transaction_id.");
    const feedback = await request(args, "POST", "/api/v1/feedback", feedbackBody(args, transactionId));
    output = { selected_service: selected, discover, invoke, feedback };
  }
  print(output, args.json === "true");
}

main().catch((error) => {
  console.error(error.message);
  if (error.status === 402 && error.body) {
    console.error("L402 payment required. Use x-api-key for agent auth and retry with an L402 Authorization header.");
  }
  if (error.body) console.error(JSON.stringify(error.body, null, 2));
  process.exit(1);
});
