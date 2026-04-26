import { and, desc, eq, sum } from "drizzle-orm";
import { KpiStat } from "@/components/kpi-stat";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const { providerAccounts, ledgerEntries } = schema;

export default async function ProviderFundsPage() {
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL for funds view.
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider/funds");

  const db = getDb();
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));
  if (!acct) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold text-zinc-100">Funds</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Onboard as a provider first.{" "}
          <Link href="/provider/onboarding" className="text-amber-500 hover:underline">
            Onboarding
          </Link>
        </p>
      </main>
    );
  }

  const accountKey = String(acct.id);

  const [agg] = await db
    .select({ totalSats: sum(ledgerEntries.deltaSats) })
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.accountType, "provider"), eq(ledgerEntries.accountId, accountKey)),
    );

  const [creditAgg] = await db
    .select({ s: sum(ledgerEntries.deltaSats) })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.accountType, "provider"),
        eq(ledgerEntries.accountId, accountKey),
        eq(ledgerEntries.reason, "marketplace_order_credit"),
      ),
    );

  const recent = await db
    .select()
    .from(ledgerEntries)
    .where(
      and(eq(ledgerEntries.accountType, "provider"), eq(ledgerEntries.accountId, accountKey)),
    )
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(25);

  const net = Number(agg?.totalSats ?? 0);
  const earned = Number(creditAgg?.s ?? 0);

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Funds</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Ledger balances for <span className="text-amber-500">@{acct.handle}</span> (demo — no
        payout rail).
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <KpiStat label="Net ledger (sats)" value={`${net}`} hint="All provider ledger rows" />
        <KpiStat
          label="Order credits (sats)"
          value={`${earned}`}
          hint="Gross before platform fee in MVP model"
        />
        <KpiStat label="Pending payout" value="—" hint="Wire in a processor post-hackathon" />
      </div>

      <h2 className="mt-12 text-sm font-medium text-zinc-300">Recent ledger</h2>
      <ul className="mt-3 space-y-2 text-xs text-zinc-500">
        {recent.length === 0 ? (
          <li>No ledger movement yet.</li>
        ) : (
          recent.map((e) => (
            <li key={e.id} className="rounded border border-zinc-800 bg-zinc-900/30 p-2 font-mono">
              {e.createdAt?.toISOString?.() ?? ""} · {e.reason} · {e.deltaSats} sats
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
