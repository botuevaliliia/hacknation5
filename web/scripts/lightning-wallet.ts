/**
 * Pay a BOLT11 invoice using the MDK-hosted LDK node (same wallet as L402 on the server).
 * Requires MDK_ACCESS_TOKEN and MDK_MNEMONIC in the environment.
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env", ".env.local"] as const) {
  const p = resolve(webRoot, name);
  if (existsSync(p)) {
    loadEnv({ path: p, override: name === ".env.local" });
  }
}

const runtimeRequire = createRequire(import.meta.url);

export const MAINNET_NODE_OPTIONS = {
  network: "mainnet",
  vssUrl: "https://vss.moneydevkit.com/vss",
  esploraUrl: "https://esplora.moneydevkit.com/api",
  rgsUrl: "https://rapidsync.lightningdevkit.org/snapshot/v2",
  lspNodeId: "02a63339cc6b913b6330bd61b2f469af8785a6011a6305bb102298a8e76697473b",
  lspAddress: "lsp.moneydevkit.com:9735",
};

type MdkNodeCtor = new (opts: Record<string, string>) => {
  pay: (
    destination: string,
    amountMsat?: number | null,
    waitSecs?: number | null,
  ) => { preimage?: string; paymentId?: string };
  destroy: () => void;
};

export function payBolt11Invoice(invoice: string, waitForPaymentSecs = 120): string {
  if (process.env.MDK_VERBOSE_LIGHTNING !== "1" && !process.env.RUST_LOG) {
    process.env.RUST_LOG = "error";
  }

  const bolt11 = invoice.trim();
  if (!bolt11.toLowerCase().startsWith("lnbc") && !bolt11.toLowerCase().startsWith("lntb")) {
    throw new Error("Expected a BOLT11 invoice (usually starts with lnbc…).");
  }

  const access = process.env.MDK_ACCESS_TOKEN?.trim();
  const mnemonic = process.env.MDK_MNEMONIC?.trim();
  if (!access || !mnemonic) {
    throw new Error("Set MDK_ACCESS_TOKEN and MDK_MNEMONIC (same as Vercel / MDK dashboard).");
  }

  const { MdkNode } = runtimeRequire("@moneydevkit/lightning-js") as { MdkNode: MdkNodeCtor };

  const node = new MdkNode({
    network: process.env.MDK_NETWORK || MAINNET_NODE_OPTIONS.network,
    mdkApiKey: access,
    mnemonic,
    vssUrl: process.env.MDK_VSS_URL || MAINNET_NODE_OPTIONS.vssUrl,
    esploraUrl: process.env.MDK_ESPLORA_URL || MAINNET_NODE_OPTIONS.esploraUrl,
    rgsUrl: process.env.MDK_RGS_URL || MAINNET_NODE_OPTIONS.rgsUrl,
    lspNodeId: process.env.MDK_LSP_NODE_ID || MAINNET_NODE_OPTIONS.lspNodeId,
    lspAddress: process.env.MDK_LSP_ADDRESS || MAINNET_NODE_OPTIONS.lspAddress,
  });

  try {
    const result = node.pay(bolt11, null, waitForPaymentSecs);
    const preimage = result.preimage;
    if (!preimage) {
      throw new Error(
        "Payment did not return a preimage yet. Check outbound liquidity / channel usable in MDK dashboard, then retry.",
      );
    }
    return preimage;
  } finally {
    node.destroy();
  }
}
