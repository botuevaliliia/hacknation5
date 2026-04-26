import { desc, eq } from "drizzle-orm";
import { createProviderProduct, listCatalogServiceIds } from "@/app/provider/actions";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const { providerAccounts, providerProducts } = schema;

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ProviderProductsPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const err = typeof sp.error === "string" ? sp.error : null;

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL to manage products.
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider/products");

  const db = getDb();
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));
  if (!acct) redirect("/provider/onboarding");

  const products = await db
    .select()
    .from(providerProducts)
    .where(eq(providerProducts.providerAccountId, acct.id))
    .orderBy(desc(providerProducts.createdAt));

  const catalog = await listCatalogServiceIds();

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Products</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Listings appear in the buyer market. Each product must map to a catalog{" "}
        <code className="text-zinc-400">service_id</code> used by invoke.
      </p>
      {err ? (
        <p className="mt-4 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {err}
        </p>
      ) : null}

      <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-medium text-zinc-200">Add product</h2>
        <form action={createProviderProduct} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-zinc-500 sm:col-span-2">
            Title
            <input
              name="title"
              required
              className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-500 sm:col-span-2">
            Description
            <textarea
              name="description"
              required
              rows={3}
              className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Type
            <select
              name="type"
              className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="agent">agent</option>
              <option value="dataset">dataset</option>
              <option value="mcp_server">mcp_server</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Price (sats)
            <input
              name="price_sats"
              type="number"
              min={0}
              defaultValue={100}
              className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-500 sm:col-span-2">
            Linked catalog service
            <select
              name="linked_service_id"
              required
              className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Select…</option>
              {catalog.map((c) => (
                <option key={c.serviceId} value={c.serviceId}>
                  {c.serviceId} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
            >
              Publish product
            </button>
          </div>
        </form>
      </section>

      <ul className="mt-10 space-y-3">
        {products.length === 0 ? (
          <li className="text-sm text-zinc-500">No products yet.</li>
        ) : (
          products.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-zinc-100">{p.title}</span>
                <span className="text-amber-500/90">{p.priceSats ?? 0} sats</span>
              </div>
              <p className="mt-1 text-xs uppercase text-zinc-600">{p.type}</p>
              <p className="mt-2 line-clamp-2 text-zinc-500">{p.description}</p>
              <p className="mt-2 font-mono text-xs text-zinc-600">
                service <span className="text-zinc-400">{p.linkedServiceId}</span>
              </p>
            </li>
          ))
        )}
      </ul>

      <p className="mt-8 text-xs text-zinc-600">
        Preview as buyer:{" "}
        <Link href="/dashboard/market" className="text-amber-500 hover:underline">
          /dashboard/market
        </Link>
      </p>
    </main>
  );
}
