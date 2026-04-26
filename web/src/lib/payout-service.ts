import { and, eq, sum } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { providerAccounts, ledgerEntries, usageEvents } = schema;

export type PayoutRunInput = {
  minPayoutSats: number;
  maxProviders: number;
};

export type PayoutRunResult = {
  attempted: number;
  settled: number;
  skippedNoAddress: number;
  skippedBelowThreshold: number;
  skippedNoWebhook: number;
  skippedAlreadySettled: number;
  errors: Array<{ providerAccountId: string; error: string }>;
};

function getPayoutAddress(prefs: unknown): string | null {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return null;
  const p = prefs as Record<string, unknown>;
  const addr = String(p.lightningAddress ?? p.lightning_address ?? "").trim();
  return addr || null;
}

async function settleProviderPayout(params: {
  providerAccountId: string;
  ownerUserId: string;
  payoutAddress: string;
  amountSats: number;
  idempotencyKey: string;
}): Promise<
  | { ok: true; payload: Record<string, unknown>; idempotencyKey: string }
  | { ok: false; error: string; idempotencyKey: string }
> {
  const webhook = process.env.A2A_PAYOUT_WEBHOOK_URL?.trim() || "";
  if (!webhook) {
    return { ok: false, error: "payout_webhook_not_configured", idempotencyKey: params.idempotencyKey };
  }
  const token = process.env.A2A_PAYOUT_WEBHOOK_TOKEN?.trim() || "";
  const idempotencyKey = params.idempotencyKey;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: "provider_payout",
        provider_account_id: params.providerAccountId,
        owner_user_id: params.ownerUserId,
        payout_address: params.payoutAddress,
        amount_sats: params.amountSats,
        idempotency_key: idempotencyKey,
      }),
    });
    let payload: Record<string, unknown> = {};
    try {
      payload = (await res.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    if (!res.ok) {
      return { ok: false, error: `webhook_http_${res.status}`, idempotencyKey };
    }
    return { ok: true, payload: { ...payload, idempotency_key: idempotencyKey }, idempotencyKey };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "webhook_request_failed", idempotencyKey };
  }
}

export async function runProviderPayouts(input: PayoutRunInput): Promise<PayoutRunResult> {
  const db = getDb();
  const minPayoutSats = Math.max(1, Math.floor(input.minPayoutSats || 100));
  const maxProviders = Math.max(1, Math.min(200, Math.floor(input.maxProviders || 20)));
  const accounts = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.status, "active"))
    .limit(maxProviders);

  const result: PayoutRunResult = {
    attempted: 0,
    settled: 0,
    skippedNoAddress: 0,
    skippedBelowThreshold: 0,
    skippedNoWebhook: 0,
    skippedAlreadySettled: 0,
    errors: [],
  };

  const hasWebhook = Boolean(process.env.A2A_PAYOUT_WEBHOOK_URL?.trim());
  for (const acct of accounts) {
    const payoutAddress = getPayoutAddress(acct.payoutPrefsJson);
    if (!payoutAddress) {
      result.skippedNoAddress += 1;
      continue;
    }
    const [agg] = await db
      .select({ total: sum(ledgerEntries.deltaSats) })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.accountType, "provider"),
          eq(ledgerEntries.accountId, String(acct.id)),
        ),
      );
    const availableSats = Number(agg?.total ?? 0);
    if (!Number.isFinite(availableSats) || availableSats < minPayoutSats) {
      result.skippedBelowThreshold += 1;
      continue;
    }
    if (!hasWebhook) {
      result.skippedNoWebhook += 1;
      continue;
    }
    const idempotencyKey = `provider:${acct.id}:amount:${Math.floor(availableSats)}`;
    const payoutReason = `provider_payout_sent:${idempotencyKey}`;
    const [alreadySettled] = await db
      .select()
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.accountType, "provider"),
          eq(ledgerEntries.accountId, String(acct.id)),
          eq(ledgerEntries.reason, payoutReason),
        ),
      );
    if (alreadySettled) {
      result.skippedAlreadySettled += 1;
      continue;
    }
    result.attempted += 1;

    const settled = await settleProviderPayout({
      providerAccountId: String(acct.id),
      ownerUserId: acct.ownerUserId,
      payoutAddress,
      amountSats: Math.floor(availableSats),
      idempotencyKey,
    });
    if (!settled.ok) {
      result.errors.push({ providerAccountId: String(acct.id), error: settled.error });
      continue;
    }

    // Decrease provider withdrawable balance after successful external payout execution.
    await db.insert(ledgerEntries).values({
      accountType: "provider",
      accountId: String(acct.id),
      orderId: null,
      deltaSats: -Math.floor(availableSats),
      deltaUsd: null,
      reason: payoutReason,
    });
    await db.insert(usageEvents).values({
      providerProductId: null,
      buyerUserId: acct.ownerUserId,
      agentTransactionId: null,
      eventType: "payout",
      meta: {
        provider_account_id: acct.id,
        amount_sats: Math.floor(availableSats),
        payout_address: payoutAddress,
        webhook_response: settled.payload,
      },
    });
    result.settled += 1;
  }

  return result;
}
