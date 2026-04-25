#!/usr/bin/env npx tsx
/**
 * Call an L402-gated URL: first request → 402 + invoice → pay with MDK → retry with L402 header.
 * No manual copying of long bolt11 strings.
 *
 * Usage:
 *   npm run l402 -- GET https://hacknation5.vercel.app/api/v1/insight
 *   npm run l402 -- POST https://hacknation5.vercel.app/api/v1/invoke \
 *     --agent-key "$AGENT_API_KEY" \
 *     '{"service_id":"tavily_search","agent_id":"demo","task":"x","budget_usd":2,"input":{"query":"ai"}}'
 *
 * Env: MDK_ACCESS_TOKEN, MDK_MNEMONIC
 */
import { payBolt11Invoice } from "./lightning-wallet";

type Json = Record<string, unknown>;

function parseArgs(): {
  method: "GET" | "POST";
  url: string;
  body: string | null;
  agentKey: string | null;
} {
  const argv = process.argv.slice(2);
  let agentKey: string | null = null;
  const filtered: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--agent-key" && argv[i + 1]) {
      agentKey = argv[i + 1];
      i++;
      continue;
    }
    filtered.push(argv[i]);
  }
  const method = (filtered[0] || "GET").toUpperCase() as "GET" | "POST";
  const url = filtered[1];
  const body = filtered[2] ?? null;
  if (!url) {
    throw new Error(
      'Usage: tsx scripts/l402-request.ts [GET|POST] <url> [json-body]\nExample: tsx scripts/l402-request.ts GET https://hacknation5.vercel.app/api/v1/insight',
    );
  }
  if (method !== "GET" && method !== "POST") {
    throw new Error("Method must be GET or POST");
  }
  return { method, url, body, agentKey };
}

async function fetchOnce(
  method: "GET" | "POST",
  url: string,
  body: string | null,
  headers: Record<string, string>,
): Promise<Response> {
  const h = new Headers(headers);
  if (method === "POST") {
    h.set("content-type", "application/json");
  }
  return fetch(url, {
    method,
    headers: h,
    body: method === "POST" && body ? body : undefined,
  });
}

async function main() {
  const { method, url, body, agentKey } = parseArgs();

  const baseHeaders: Record<string, string> = {};
  if (agentKey) {
    baseHeaders["x-api-key"] = agentKey;
  }

  let res = await fetchOnce(method, url, body, baseHeaders);
  const text1 = await res.text();

  if (res.status !== 402) {
    console.log(text1);
    if (!res.ok) process.exit(1);
    return;
  }

  let challenge: Json;
  try {
    challenge = JSON.parse(text1) as Json;
  } catch {
    console.error("402 but body is not JSON:", text1.slice(0, 500));
    process.exit(1);
  }

  const macaroon = String(challenge.macaroon ?? "");
  const invoice = String(challenge.invoice ?? "");
  if (!macaroon || !invoice) {
    console.error("402 missing macaroon or invoice:", challenge);
    process.exit(1);
  }

  console.error("L402: paying invoice with MDK wallet…");
  const preimage = payBolt11Invoice(invoice);

  const auth = `L402 ${macaroon}:${preimage}`;
  const retryHeaders: Record<string, string> = { ...baseHeaders, Authorization: auth };
  res = await fetchOnce(method, url, body, retryHeaders);
  const text2 = await res.text();
  console.log(text2);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
