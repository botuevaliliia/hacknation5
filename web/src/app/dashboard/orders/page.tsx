import { desc, eq } from "drizzle-orm";
import { FeedbackForm } from "@/components/feedback-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb, isDatabaseConfigured, schema } from "@/db";

export const dynamic = "force-dynamic";

const { marketplaceOrders, providerProducts } = schema;

export default async function DashboardOrdersPage() {
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
        Sign in with a configured database to see orders.
      </main>
    );
  }

  const db = getDb();
  const orders = await db
    .select({
      o: marketplaceOrders,
      title: providerProducts.title,
    })
    .from(marketplaceOrders)
    .innerJoin(providerProducts, eq(marketplaceOrders.providerProductId, providerProducts.id))
    .where(eq(marketplaceOrders.buyerUserId, userId))
    .orderBy(desc(marketplaceOrders.createdAt))
    .limit(40);

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Orders</h1>
      <p className="mt-2 text-sm text-zinc-500">
        After invoke completes, submit feedback here to close the loop (updates reputation + usage).
      </p>
      <ul className="mt-8 space-y-4">
        {orders.map(({ o, title }) => (
          <li
            key={o.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400"
          >
            <div className="font-mono text-xs text-zinc-500">{o.id}</div>
            <div className="mt-1 text-zinc-200">{title}</div>
            <div className="mt-1 text-xs">
              payment: {o.paymentStatus} · delivery: {o.deliveryStatus} · {o.amountSats} sats
            </div>
            {o.agentTransactionId && o.deliveryStatus !== "closed" ? (
              <div className="mt-3 border-t border-zinc-800 pt-3">
                <FeedbackForm transactionId={o.agentTransactionId} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
