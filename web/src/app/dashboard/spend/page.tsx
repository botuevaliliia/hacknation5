import { and, desc, eq, sum } from "drizzle-orm";
import { KpiStat } from "@/components/kpi-stat";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb, isDatabaseConfigured, schema } from "@/db";

export const dynamic = "force-dynamic";

const { ledgerEntries, marketplaceOrders } = schema;

export default async function DashboardSpendPage() {
  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!isDatabaseConfigured() || !userId) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Sign in to see spend analytics.
      </main>
    );
  }

  const db = getDb();
  const [agg] = await db
    .select({ totalSats: sum(ledgerEntries.deltaSats) })
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.accountType, "buyer"), eq(ledgerEntries.accountId, userId)),
    );

  const recent = await db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.accountType, "buyer"), eq(ledgerEntries.accountId, userId)))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(20);

  const [orderSpend] = await db
    .select({ s: sum(marketplaceOrders.amountSats) })
    .from(marketplaceOrders)
    .where(eq(marketplaceOrders.buyerUserId, userId));

  const orderTimeline = await db
    .select({
      id: marketplaceOrders.id,
      amountSats: marketplaceOrders.amountSats,
      paymentStatus: marketplaceOrders.paymentStatus,
      deliveryStatus: marketplaceOrders.deliveryStatus,
      createdAt: marketplaceOrders.createdAt,
    })
    .from(marketplaceOrders)
    .where(eq(marketplaceOrders.buyerUserId, userId))
    .orderBy(desc(marketplaceOrders.createdAt))
    .limit(15);

  const total = Number(agg?.totalSats ?? 0);
  const ordersTotalSats = Number(orderSpend?.s ?? 0);

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Spend</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Ledger view of sat movements attributed to your buyer account (demo accounting).
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStat
          label="Net sats (buyer ledger)"
          value={`${total}`}
          hint="Negative means spend; positive would be refunds/credits."
        />
        <KpiStat
          label="Orders (sats, sum)"
          value={`${ordersTotalSats}`}
          hint="Listed order amounts you placed"
        />
        <KpiStat label="Ledger rows" value={`${recent.length}`} hint="Most recent 20 below." />
        <KpiStat label="Orders shown" value={`${orderTimeline.length}`} hint="Recent purchases" />
      </div>
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-zinc-300">Ledger timeline</h2>
          <ul className="mt-3 space-y-2 text-xs text-zinc-500">
            {recent.map((e) => (
              <li key={e.id} className="rounded border border-zinc-800 bg-zinc-900/30 p-3 font-mono">
                {e.createdAt?.toISOString?.() ?? ""} · {e.reason} · {e.deltaSats} sats
                {e.deltaUsd != null ? ` · $${e.deltaUsd}` : ""}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-medium text-zinc-300">Order timeline</h2>
          <ul className="mt-3 space-y-2 text-xs text-zinc-500">
            {orderTimeline.length === 0 ? (
              <li>No orders yet.</li>
            ) : (
              orderTimeline.map((o) => (
                <li
                  key={o.id}
                  className="rounded border border-zinc-800 bg-zinc-900/30 p-3 font-mono"
                >
                  {o.createdAt?.toISOString?.() ?? ""} · {o.deliveryStatus} · {o.amountSats} sats ·{" "}
                  {o.paymentStatus}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
