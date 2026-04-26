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

export default async function DashboardMarketPage() {
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
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Market</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        <strong className="font-medium text-zinc-400">Buyable cards</strong> are{" "}
        <code className="text-zinc-400">provider_products</code> from sellers. Each product points at
        one <code className="text-zinc-400">service_id</code> in the catalog — invoke runs{" "}
        <strong className="text-zinc-400">inside this Next.js app</strong> (e.g.{" "}
        <code className="text-zinc-400">/api/v1/invoke</code> or checkout after buy), not a separate
        microservice you deploy.
      </p>

      {demoCatalog.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
          <h2 className="text-sm font-medium text-zinc-200">HTTP agent templates (seller-deployed)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Each row is a <strong className="text-zinc-400">contract</strong> you implement by
            deploying the sample server under <code className="text-zinc-500">demo-agent-apis/</code>{" "}
            in this repo (Fly/Railway/Docker). Then in{" "}
            <Link href="/provider/products" className="text-amber-500 hover:underline">
              Provider → Products
            </Link>{" "}
            link the row and set your <strong>Base URL</strong>. The marketplace gateway calls{" "}
            <code className="text-zinc-500">POST /invoke</code> on your origin.
          </p>
          <ul className="mt-4 space-y-3 text-xs text-zinc-400">
            {demoCatalog.map((d) => (
              <li key={d.serviceId} className="font-mono">
                <span className="text-amber-500/90">{d.serviceId}</span>
                <span className="text-zinc-600"> — </span>
                <span className="text-zinc-300">{d.name}</span>
                <span className="block normal-case text-zinc-600">{d.description}</span>
                <span className="mt-0.5 block whitespace-pre-wrap normal-case text-zinc-500">
                  {d.modelCard}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {rows.length === 0 ? (
          <li className="text-sm text-zinc-500">
            No provider products yet. Deploy an agent from <code className="text-zinc-400">demo-agent-apis/</code>, then
            publish a product with Base URL + one of the <code className="text-zinc-400">external_agent_*</code>{" "}
            catalog rows above.
          </li>
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
