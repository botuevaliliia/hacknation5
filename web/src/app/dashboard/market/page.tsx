import { desc, eq } from "drizzle-orm";
import { BuyProductButton } from "@/components/buy-product-button";
import { getDb, isDatabaseConfigured, schema } from "@/db";

export const dynamic = "force-dynamic";

const { providerProducts, providerAccounts } = schema;

function defaultInvokeInput(linkedServiceId: string): Record<string, unknown> {
  if (linkedServiceId.includes("tavily")) {
    return { query: "marketplace demo search" };
  }
  if (linkedServiceId.includes("openrouter")) {
    return { prompt: "Say hello in one sentence for a marketplace demo." };
  }
  if (linkedServiceId.includes("serper")) {
    return { query: "agent economy lightning" };
  }
  if (linkedServiceId.includes("exa")) {
    return { query: "agent economy lightning" };
  }
  if (linkedServiceId.includes("firecrawl")) {
    return { url: "https://example.com" };
  }
  return { query: "demo" };
}

export default async function DashboardMarketPage() {
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL to browse provider products.
      </main>
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      p: providerProducts,
      handle: providerAccounts.handle,
    })
    .from(providerProducts)
    .innerJoin(providerAccounts, eq(providerProducts.providerAccountId, providerAccounts.id))
    .where(eq(providerProducts.active, 1))
    .orderBy(desc(providerProducts.createdAt));

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Market</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Provider listings mapped to catalog services. Buying records spend in your ledger and runs
        invoke server-side.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {rows.length === 0 ? (
          <li className="text-sm text-zinc-500">No products yet. Ask a provider to onboard.</li>
        ) : (
          rows.map(({ p, handle }) => (
            <li
              key={p.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs uppercase text-amber-500/80">{p.type}</span>
                  <h2 className="text-lg font-medium text-zinc-100">{p.title}</h2>
                </div>
                <span className="shrink-0 text-amber-500/90">{p.priceSats ?? 0} sats</span>
              </div>
              <p className="mt-2 line-clamp-3 text-zinc-500">{p.description}</p>
              <p className="mt-2 text-xs text-zinc-600">
                @{handle} · service <code className="text-zinc-400">{p.linkedServiceId}</code>
              </p>
              <BuyProductButton
                productId={p.id}
                defaultInput={defaultInvokeInput(p.linkedServiceId ?? "")}
              />
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
