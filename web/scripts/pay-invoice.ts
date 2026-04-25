#!/usr/bin/env npx tsx
/**
 * Pay a Lightning BOLT11 invoice with your MDK wallet (no copy-paste into a separate wallet UI).
 *
 * Usage:
 *   npm run pay:invoice -- 'lnbc1...'
 *   echo 'lnbc1...' | npm run pay:invoice
 *
 * Prints the payment preimage (use as L402 proof: Authorization: L402 <macaroon>:<preimage>).
 *
 * Env: MDK_ACCESS_TOKEN, MDK_MNEMONIC (and optional MDK_* overrides from lightning-wallet.ts).
 */
import { payBolt11Invoice } from "./lightning-wallet";

function readInvoiceFromArgvOrStdin(): Promise<string> {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  if (arg) return Promise.resolve(arg);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c) => chunks.push(c as Buffer));
    process.stdin.on("end", () => {
      const s = Buffer.concat(chunks).toString("utf8").trim();
      if (!s) reject(new Error("Pass invoice as first argument or pipe it on stdin."));
      else resolve(s);
    });
  });
}

async function main() {
  const invoice = await readInvoiceFromArgvOrStdin();
  const wait = Number(process.env.MDK_PAY_WAIT_SECS || "120");
  console.error("Paying invoice with MDK node (wait up to " + wait + "s)…");
  const preimage = payBolt11Invoice(invoice, Number.isFinite(wait) ? wait : 120);
  console.log(preimage);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
