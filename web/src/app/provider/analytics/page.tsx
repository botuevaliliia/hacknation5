import { and, count, desc, eq, inArray } from "drizzle-orm";
import { KpiStat } from "@/components/kpi-stat";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const {
  providerAccounts,
  providerProducts,
  usageEvents,
  marketplaceOrders,
} = schema;

export default async function ProviderAnalyticsPage() {
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL for analytics.
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider/analytics");

  const db = getDb();
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));
  if (!acct) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold text-zinc-100">Analytics</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Create a provider account first.{" "}
          <Link href="/provider/onboarding" className="text-amber-500 hover:underline">
            Onboarding
          </Link>
        </p>
      </main>
    );
  }

  const products = await db
    .select({ id: providerProducts.id })
    .from(providerProducts)
    .where(eq(providerProducts.providerAccountId, acct.id));
  const productIds = products.map((p) => p.id);

  let invokeCount = 0;
  let feedbackCount = 0;
  let orderCount = 0;
  if (productIds.length > 0) {
    const [iRow] = await db
      .select({ n: count() })
      .from(usageEvents)
      .where(
        and(inArray(usageEvents.providerProductId, productIds), eq(usageEvents.eventType, "invoke")),
      );
    const [fRow] = await db
      .select({ n: count() })
      .from(usageEvents)
      .where(
        and(
          inArray(usageEvents.providerProductId, productIds),
          eq(usageEvents.eventType, "feedback"),
        ),
      );
    const [oRow] = await db
      .select({ n: count() })
      .from(marketplaceOrders)
      .innerJoin(
        providerProducts,
        eq(marketplaceOrders.providerProductId, providerProducts.id),
      )
      .where(eq(providerProducts.providerAccountId, acct.id));
    invokeCount = Number(iRow?.n ?? 0);
    feedbackCount = Number(fRow?.n ?? 0);
    orderCount = Number(oRow?.n ?? 0);
  }

  const timeline =
    productIds.length === 0
      ? []
      : await db
          .select()
          .from(usageEvents)
          .where(inArray(usageEvents.providerProductId, productIds))
          .orderBy(desc(usageEvents.createdAt))
          .limit(25);

  const closedOrders =
    productIds.length === 0
      ? []
      : await db
          .select({
            id: marketplaceOrders.id,
            deliveryStatus: marketplaceOrders.deliveryStatus,
            amountSats: marketplaceOrders.amountSats,
            createdAt: marketplaceOrders.createdAt,
            productId: marketplaceOrders.providerProductId,
          })
          .from(marketplaceOrders)
          .innerJoin(
            providerProducts,
            eq(marketplaceOrders.providerProductId, providerProducts.id),
          )
          .where(eq(providerProducts.providerAccountId, acct.id))
          .orderBy(desc(marketplaceOrders.createdAt))
          .limit(15);

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Analytics</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Usage and orders for <span className="text-amber-500">@{acct.handle}</span>.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStat label="Invokes" value={String(invokeCount)} hint="Recorded usage_events" />
        <KpiStat label="Feedback" value={String(feedbackCount)} hint="Buyer closed loops" />
        <KpiStat label="Orders" value={String(orderCount)} hint="All marketplace orders" />
        <KpiStat
          label="Products"
          value={String(productIds.length)}
          hint="Active listings you own"
        />
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-zinc-300">Usage timeline</h2>
          <ul className="mt-3 space-y-2 text-xs text-zinc-500">
            {timeline.length === 0 ? (
              <li>No usage yet.</li>
            ) : (
              timeline.map((e) => (
                <li
                  key={e.id}
                  className="rounded border border-zinc-800 bg-zinc-900/30 p-2 font-mono"
                >
                  {e.createdAt?.toISOString?.() ?? ""} · {e.eventType}
                  {e.buyerUserId ? ` · buyer ${e.buyerUserId.slice(0, 8)}…` : ""}
                </li>
              ))
            )}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-medium text-zinc-300">Order timeline</h2>
          <ul className="mt-3 space-y-2 text-xs text-zinc-500">
            {closedOrders.length === 0 ? (
              <li>No orders yet.</li>
            ) : (
              closedOrders.map((o) => (
                <li
                  key={o.id}
                  className="rounded border border-zinc-800 bg-zinc-900/30 p-2 font-mono"
                >
                  {o.createdAt?.toISOString?.() ?? ""} · {o.deliveryStatus} · {o.amountSats} sats
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
