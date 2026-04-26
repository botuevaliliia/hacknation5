import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { BuyProductButton } from "@/components/buy-product-button";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { ensureAgentCatalog } from "@/marketplace/catalog/loader";

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
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL to browse provider products.
      </main>
    );
  }

  const db = getDb();
  await ensureAgentCatalog();
  const whereClause = q
    ? and(
        eq(providerProducts.active, 1),
        or(
          ilike(providerProducts.title, `%${q}%`),
          ilike(providerProducts.description, `%${q}%`),
          ilike(providerProducts.linkedServiceId, `%${q}%`),
          ilike(providerAccounts.handle, `%${q}%`),
        ),
      )
    : eq(providerProducts.active, 1);

  const rows = await db
    .select({
      p: providerProducts,
      handle: providerAccounts.handle,
      ownerUserId: providerAccounts.ownerUserId,
    })
    .from(providerProducts)
    .innerJoin(providerAccounts, eq(providerProducts.providerAccountId, providerAccounts.id))
    .where(whereClause)
    .orderBy(desc(providerProducts.createdAt));

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-semibold text-white">Market</h1>
      <p className="mt-2 max-w-3xl text-base text-zinc-300">
        All user-published services on the platform. Search by title, provider, description, or
        service ID.
      </p>
      {info === "already_signed_in" ? (
        <p className="mt-4 rounded border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          You are already signed in.
        </p>
      ) : null}

      <form className="mt-6 max-w-md">
        <label className="text-sm text-zinc-300">
          Search services
          <div className="mt-2 flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="search title, provider, service id..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
            <button
              type="submit"
              className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-100 hover:border-zinc-400"
            >
              Search
            </button>
          </div>
        </label>
      </form>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {rows.length === 0 ? (
          <li className="text-sm text-zinc-500">
            No services found. Try a different search, or publish a new service from{" "}
            <Link href="/provider/products" className="text-amber-400 hover:underline">
              My services
            </Link>
            .
          </li>
        ) : (
          rows.map(({ p, handle, ownerUserId }) => (
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
              <p className="mt-1 text-xs text-zinc-500">
                provider_id <code className="text-zinc-400">{ownerUserId}</code>
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
