import { desc, eq } from "drizzle-orm";
import { createProviderProduct, listCatalogServiceIds } from "@/app/provider/actions";
import { ProviderProductForm } from "@/components/provider-product-form";
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
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-semibold text-white">My services</h1>
      <p className="mt-2 max-w-3xl text-base text-zinc-300">
        Publish and manage services for buyers. You can reference an existing service contract ID
        or create your own contract ID directly from this form.
      </p>
      {err ? (
        <p className="mt-4 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {err}
        </p>
      ) : null}

      <section className="mt-10 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-lg">
        <h2 className="text-base font-semibold text-white">Add product</h2>
        <ProviderProductForm catalog={catalog} action={createProviderProduct} />
      </section>

      <ul className="mt-10 space-y-3">
        {products.length === 0 ? (
          <li className="text-sm text-zinc-500">No products yet.</li>
        ) : (
          products.map((p) => (
            <li key={p.id} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-300 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-white">{p.title}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
                    {p.priceSats ?? 0} sats
                  </span>
                  <Link
                    href={`/provider/products/${p.id}/edit`}
                    className="rounded-full border border-zinc-600 px-3 py-0.5 text-xs text-zinc-200 hover:border-amber-500/50 hover:text-amber-200"
                  >
                    Edit
                  </Link>
                </div>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400">{p.type}</p>
              <p className="mt-2 line-clamp-2 text-zinc-300">{p.description}</p>
              <p className="mt-2 font-mono text-xs text-zinc-400">
                service <span className="text-zinc-400">{p.linkedServiceId}</span>
                {p.endpointMetadata &&
                typeof p.endpointMetadata === "object" &&
                "base_url" in p.endpointMetadata &&
                String((p.endpointMetadata as { base_url?: string }).base_url ?? "") ? (
                  <span className="mt-1 block text-zinc-400">
                    base{" "}
                    <span className="text-amber-300">
                      {String((p.endpointMetadata as { base_url?: string }).base_url)}
                    </span>
                  </span>
                ) : null}
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
