import { createRequire } from "node:module";

const runtimeRequire = createRequire(import.meta.url);

const MAINNET_NODE_OPTIONS = {
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

export function looksLikeBolt11(value: string): boolean {
  return /^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value.trim());
}

/** Real LN payment for BOLT11 destinations via MDK-hosted LDK node. */
export function payBolt11ViaMdk(invoice: string, waitForPaymentSecs = 120): string {
  if (process.env.MDK_VERBOSE_LIGHTNING !== "1" && !process.env.RUST_LOG) {
    process.env.RUST_LOG = "error";
  }
  const bolt11 = invoice.trim();
  if (!looksLikeBolt11(bolt11)) {
    throw new Error("Expected BOLT11 invoice (lnbc/lntb/lnbcrt...).");
  }
  const access = process.env.MDK_ACCESS_TOKEN?.trim();
  const mnemonic = process.env.MDK_MNEMONIC?.trim();
  if (!access || !mnemonic) {
    throw new Error("Missing MDK_ACCESS_TOKEN/MDK_MNEMONIC for real payout.");
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
    if (!result.preimage) {
      throw new Error("Payment attempted but no preimage returned.");
    }
    return result.preimage;
  } finally {
    node.destroy();
  }
}
