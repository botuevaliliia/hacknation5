type Json = Record<string, unknown>;

import { createRequire } from "node:module";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "";

const LIVE_ADAPTERS = new Set(["openrouter", "tavily", "exa", "serper", "firecrawl"]);
const runtimeRequire = createRequire(import.meta.url);

const MAINNET_NODE_OPTIONS = {
  network: "mainnet",
  vssUrl: "https://vss.moneydevkit.com/vss",
  esploraUrl: "https://esplora.moneydevkit.com/api",
  rgsUrl: "https://rapidsync.lightningdevkit.org/snapshot/v2",
  lspNodeId: "02a63339cc6b913b6330bd61b2f469af8785a6011a6305bb102298a8e76697473b",
  lspAddress: "lsp.moneydevkit.com:9735",
};

function required(name: string, value: string): string {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in environment or .env.local.`);
  }
  return value;
}

function buildInput(adapterType: string): Json {
  switch (adapterType) {
    case "openrouter":
      return { prompt: "Give 3 concise bullet points on major AI news this week." };
    case "tavily":
      return { query: "major AI news this week" };
    case "exa":
      return { query: "major AI news this week" };
    case "serper":
      return { query: "major AI news this week" };
    case "firecrawl":
      return { url: "https://aiweekly.co/ai-news-today" };
    default:
      return { query: "major AI news this week" };
  }
}

async function post(path: string, body: Json): Promise<{ status: number; json: Json; headers: Headers }> {
  return postWithHeaders(path, body, {});
}

async function postWithHeaders(
  path: string,
  body: Json,
  extraHeaders: Record<string, string>,
): Promise<{ status: number; json: Json; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Keep agent auth out of Authorization so L402 can use Authorization header.
      "x-api-key": required("AGENT_API_KEY", AGENT_API_KEY),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  let json: Json = {};
  try {
    json = (await res.json()) as Json;
  } catch {
    json = {};
  }
  return { status: res.status, json, headers: res.headers };
}

async function payL402Invoice(invoice: string): Promise<string> {
  const { MdkNode } = runtimeRequire("@moneydevkit/lightning-js") as {
    MdkNode: new (opts: Record<string, string>) => {
      pay: (destination: string, amountMsat?: number | null, waitSecs?: number | null) => {
        preimage?: string;
      };
      destroy: () => void;
    };
  };
  const node = new MdkNode({
    network: process.env.MDK_NETWORK || MAINNET_NODE_OPTIONS.network,
    mdkApiKey: required("MDK_ACCESS_TOKEN", process.env.MDK_ACCESS_TOKEN || ""),
    mnemonic: required("MDK_MNEMONIC", process.env.MDK_MNEMONIC || ""),
    vssUrl: process.env.MDK_VSS_URL || MAINNET_NODE_OPTIONS.vssUrl,
    esploraUrl: process.env.MDK_ESPLORA_URL || MAINNET_NODE_OPTIONS.esploraUrl,
    rgsUrl: process.env.MDK_RGS_URL || MAINNET_NODE_OPTIONS.rgsUrl,
    lspNodeId: process.env.MDK_LSP_NODE_ID || MAINNET_NODE_OPTIONS.lspNodeId,
    lspAddress: process.env.MDK_LSP_ADDRESS || MAINNET_NODE_OPTIONS.lspAddress,
  });
  try {
    const result = node.pay(invoice, null, 60);
    const preimage = result.preimage;
    if (!preimage) {
      throw new Error("Payment sent but no preimage returned.");
    }
    return preimage;
  } finally {
    node.destroy();
  }
}

async function main() {
  console.log(`Running autonomous E2E against ${BASE}`);

  const discover = await post("/api/v1/discover", {
    task: "Summarize top AI news this week in 3 bullets",
    budget_usd: 2,
    ranker_mode: "synthetic_ltr",
  });
  if (discover.status >= 400) {
    console.error("discover failed:", discover.status, discover.json);
    process.exit(1);
  }

  const results = (discover.json.results as Json[] | undefined) ?? [];
  const live = results.find((r) => LIVE_ADAPTERS.has(String(r.adapterType ?? "")));
  if (!live) {
    console.error("No live adapters returned in discover results.");
    process.exit(1);
  }

  const serviceId = String(live.service_id ?? live.serviceId ?? "");
  const adapterType = String(live.adapterType ?? "");
  if (!serviceId) {
    console.error("No service_id/serviceId found on selected result:", live);
    process.exit(1);
  }
  console.log("Selected service:", serviceId, `(${adapterType})`);

  const invokePayload = {
    service_id: serviceId,
    agent_id: "autonomous-demo-agent",
    task: "Summarize top AI news this week in 3 bullets",
    budget_usd: 2,
    input: buildInput(adapterType),
    ranking_event_id: discover.json.ranking_event_id,
  };
  let invoke = await post("/api/v1/invoke", invokePayload);

  if (invoke.status === 402) {
    const macaroon = String(invoke.json.macaroon ?? "");
    const invoice = String(invoke.json.invoice ?? "");
    if (!macaroon || !invoice) {
      console.error("invoke returned 402 but challenge payload is incomplete:", invoke.json);
      process.exit(1);
    }
    console.log("L402 challenge received. Paying invoice...");
    const preimage = await payL402Invoice(invoice);
    console.log("Invoice paid. Retrying invoke with L402 proof...");
    invoke = await postWithHeaders("/api/v1/invoke", invokePayload, {
      Authorization: `L402 ${macaroon}:${preimage}`,
    });
  }
  if (invoke.status >= 400) {
    console.error("invoke failed:", invoke.status, invoke.json);
    process.exit(1);
  }

  const transactionId = String(invoke.json.transaction_id ?? "");
  if (!transactionId) {
    console.error("invoke succeeded but transaction_id missing:", invoke.json);
    process.exit(1);
  }
  console.log("transaction:", transactionId);

  const feedback = await post("/api/v1/feedback", {
    transaction_id: transactionId,
    quality_score: 0.93,
    task_success: true,
    freeform_note: "Autonomous end-to-end demo run.",
  });
  if (feedback.status >= 400) {
    console.error("feedback failed:", feedback.status, feedback.json);
    process.exit(1);
  }

  console.log("E2E complete.");
  console.log(JSON.stringify({ discover: discover.json, invoke: invoke.json, feedback: feedback.json }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
