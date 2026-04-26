import { and, desc, eq, inArray, sum } from "drizzle-orm";
import { redirect } from "next/navigation";
import { KpiStat } from "@/components/kpi-stat";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { ensureProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveLightningAddress } from "./actions";

export const dynamic = "force-dynamic";

const { profiles, providerAccounts, providerProducts, ledgerEntries, marketplaceOrders } = schema;

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function WalletPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const err = typeof sp.error === "string" ? sp.error : null;
  const saved = sp.saved === "1";

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL to use wallet and transaction analytics.
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/dashboard/wallet");
  await ensureProfile(user.id, user.email);

  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
  const [provider] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));

  const [buyerSpend] = await db
    .select({ total: sum(ledgerEntries.deltaSats) })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.accountType, "buyer"), eq(ledgerEntries.accountId, user.id)));

  let providerNet = 0;
  let providerOrders = 0;
  if (provider) {
    const [providerAgg] = await db
      .select({ total: sum(ledgerEntries.deltaSats) })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.accountType, "provider"),
          eq(ledgerEntries.accountId, String(provider.id)),
        ),
      );
    providerNet = Number(providerAgg?.total ?? 0);

    const [ordersAgg] = await db
      .select({ total: sum(marketplaceOrders.amountSats) })
      .from(marketplaceOrders)
      .innerJoin(providerProducts, eq(marketplaceOrders.providerProductId, providerProducts.id))
      .where(eq(providerProducts.providerAccountId, provider.id));
    providerOrders = Number(ordersAgg?.total ?? 0);
  }

  const recentLedger = await db
    .select()
    .from(ledgerEntries)
    .where(
      provider
        ? and(
            inArray(ledgerEntries.accountType, ["buyer", "provider"]),
            inArray(ledgerEntries.accountId, [user.id, String(provider.id)]),
          )
        : and(eq(ledgerEntries.accountType, "buyer"), eq(ledgerEntries.accountId, user.id)),
    )
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(20);

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Wallet & payouts</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Set your payout destination (Lightning Address, BTC address, or BOLT11 invoice) and track
        combined buyer/provider transaction stats.
      </p>

      {saved ? (
        <p className="mt-4 rounded border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          Wallet settings saved.
        </p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {err}
        </p>
      ) : null}

      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-medium text-zinc-200">Payout destination</h2>
        <form action={saveLightningAddress} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            name="lightning_address"
            defaultValue={profile?.lightningAddress ?? ""}
            placeholder="name@domain.com or bc1... or lnbc..."
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Save
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-600">
          Stored in your profile and mirrored into provider payout preferences when you run a
          provider account. We preserve exact casing/characters for compatibility.
        </p>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStat
          label="Buyer net sats"
          value={String(Number(buyerSpend?.total ?? 0))}
          hint="Negative means spent"
        />
        <KpiStat
          label="Provider net sats"
          value={String(providerNet)}
          hint="Only populated if you onboarded as provider"
        />
        <KpiStat label="Provider order gross" value={String(providerOrders)} hint="Sats volume" />
        <KpiStat label="Recent tx rows" value={String(recentLedger.length)} hint="Top 20 shown" />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-300">Recent transactions</h2>
        <ul className="mt-3 space-y-2 text-xs text-zinc-500">
          {recentLedger.map((row) => (
            <li key={row.id} className="rounded border border-zinc-800 bg-zinc-900/30 p-3 font-mono">
              {row.createdAt?.toISOString?.() ?? ""} · {row.accountType}:{row.accountId.slice(0, 8)} ·{" "}
              {row.reason} · {row.deltaSats} sats
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
