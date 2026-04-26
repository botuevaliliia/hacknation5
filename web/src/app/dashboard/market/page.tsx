import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { BuyProductButton } from "@/components/buy-product-button";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { ensureAgentCatalog } from "@/marketplace/catalog/loader";

export const dynamic = "force-dynamic";

const { providerProducts, providerAccounts, agentServices } = schema;

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
  if (linkedServiceId.startsWith("external_agent_")) {
    if (linkedServiceId.includes("echo")) return { message: "Hello from marketplace demo" };
    if (linkedServiceId.includes("product")) return { category: "hardware" };
    if (linkedServiceId.includes("teams")) return {};
    if (linkedServiceId.includes("sentiment")) return { text: "Ship the MVP today!" };
    if (linkedServiceId.includes("capitals")) return { country: "japan" };
    return {};
  }
  return { query: "demo" };
}

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardMarketPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const info = typeof sp.info === "string" ? sp.info : null;
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL to browse provider products.
      </main>
    );
  }

  const db = getDb();
  await ensureAgentCatalog();
  const demoCatalog = await db
    .select({
      serviceId: agentServices.serviceId,
      name: agentServices.name,
      description: agentServices.description,
      modelCard: agentServices.modelCard,
    })
    .from(agentServices)
    .where(eq(agentServices.adapterType, "http_external"))
    .orderBy(asc(agentServices.serviceId));

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
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-semibold text-white">Marketplace</h1>
      <p className="mt-2 max-w-3xl text-base text-zinc-300">
        Buyable cards are <code className="text-zinc-400">provider_products</code> from sellers.
        Each product points at a catalog contract and the gateway routes calls either to built-in
        adapters or seller-hosted APIs (for <code className="text-zinc-400">http_external</code>).
      </p>
      {info === "already_signed_in" ? (
        <p className="mt-4 rounded border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          You are already signed in.
        </p>
      ) : null}

      {demoCatalog.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-lg">
          <h2 className="text-base font-semibold text-white">Service contracts (seller-deployed APIs)</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Each row is a <strong className="text-zinc-400">contract</strong> you implement by
            deploying the sample server under <code className="text-zinc-500">demo-agent-apis/</code>{" "}
            in this repo (Fly/Railway/Docker). Then in{" "}
            <Link href="/provider/products" className="text-amber-500 hover:underline">
              Provider → Products
            </Link>{" "}
            link the row and set your <strong>Base URL</strong>. The marketplace gateway calls{" "}
            <code className="text-zinc-500">POST /invoke</code> on your origin.
          </p>
          <ul className="mt-4 space-y-3 text-sm text-zinc-200">
            {demoCatalog.map((d) => (
              <li key={d.serviceId} className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-3 font-mono">
                <span className="text-amber-400">{d.serviceId}</span>
                <span className="text-zinc-600"> — </span>
                <span className="text-zinc-100">{d.name}</span>
                <span className="mt-1 block normal-case text-zinc-300">{d.description}</span>
                <span className="mt-1 block whitespace-pre-wrap normal-case text-zinc-400">
                  {d.modelCard}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {rows.length === 0 ? (
          <li className="text-sm text-zinc-500">
            No provider products yet. Deploy an agent from <code className="text-zinc-400">demo-agent-apis/</code>, then
            publish a product with Base URL + one of the <code className="text-zinc-400">external_agent_*</code>{" "}
            catalog rows above.
          </li>
        ) : (
          rows.map(({ p, handle }) => (
            <li key={p.id} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-sm text-zinc-300 shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs uppercase text-amber-400">{p.type}</span>
                  <h2 className="text-lg font-semibold text-white">{p.title}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
                  {p.priceSats ?? 0} sats
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-zinc-300">{p.description}</p>
              <p className="mt-2 text-xs text-zinc-400">
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
