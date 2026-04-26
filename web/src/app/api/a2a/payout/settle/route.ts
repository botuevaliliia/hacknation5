import { looksLikeBolt11, payBolt11ViaMdk } from "@/lib/lightning-pay";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: { code: "unauthorized" } }, { status: 401 });
}

function ensureAuthorized(req: Request): boolean {
  const required = process.env.A2A_PAYOUT_WEBHOOK_TOKEN?.trim() || "";
  if (!required) return true;
  const auth = req.headers.get("authorization") || "";
  const got = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return got === required;
}

/**
 * Receiving webhook contract for payout execution.
 * Request body:
 * {
 *   action: "provider_payout",
 *   provider_account_id: "...",
 *   owner_user_id: "...",
 *   payout_address: "...",
 *   amount_sats: 123,
 *   idempotency_key: "..."
 * }
 */
export async function POST(req: Request) {
  if (!ensureAuthorized(req)) return unauthorized();

  let body: {
    action?: string;
    provider_account_id?: string;
    owner_user_id?: string;
    payout_address?: string;
    amount_sats?: number;
    idempotency_key?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const payoutAddress = String(body.payout_address ?? "").trim();
  const amountSats = Number(body.amount_sats);
  const idempotencyKey = String(body.idempotency_key ?? "").trim();
  if (action !== "provider_payout") {
    return Response.json({ error: { message: "Unsupported action" } }, { status: 400 });
  }
  if (!payoutAddress || !Number.isFinite(amountSats) || amountSats <= 0 || !idempotencyKey) {
    return Response.json(
      { error: { message: "payout_address, amount_sats>0, idempotency_key required" } },
      { status: 400 },
    );
  }

  // Real settlement path available today: BOLT11 invoice payout.
  if (looksLikeBolt11(payoutAddress)) {
    try {
      const preimage = payBolt11ViaMdk(
        payoutAddress,
        Math.max(5, Number(process.env.MDK_PAY_WAIT_SECS ?? 120) || 120),
      );
      return Response.json({
        ok: true,
        settled: true,
        settlement_type: "lightning_bolt11",
        tx_ref: preimage.slice(0, 16),
        preimage,
        idempotency_key: idempotencyKey,
      });
    } catch (e) {
      return Response.json(
        { error: { message: e instanceof Error ? e.message : "lightning_payment_failed" } },
        { status: 502 },
      );
    }
  }

  // Non-BOLT11 destinations require external payout rails (LNURL/Lightning Address/on-chain signer).
  return Response.json({
    ok: true,
    settled: false,
    settlement_type: "unsupported_destination",
    reason: "Provide BOLT11 invoice for fully automated real payout in current build.",
    idempotency_key: idempotencyKey,
  });
}
