import { eq } from "drizzle-orm";
import { listCatalogServiceIds, updateProviderProduct } from "@/app/provider/actions";
import { ProviderProductForm } from "@/components/provider-product-form";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const { providerAccounts, providerProducts } = schema;

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function metaString(m: Record<string, unknown>, key: string): string {
  const v = m[key];
  return typeof v === "string" ? v : "";
}

function headersJsonFromMeta(endpointMetadata: Record<string, unknown> | null): string {
  if (!endpointMetadata) return "{}";
  const h = endpointMetadata.headers;
  if (h && typeof h === "object" && !Array.isArray(h)) {
    try {
      return JSON.stringify(h);
    } catch {
      return "{}";
    }
  }
  return "{}";
}

export default async function EditProviderProductPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const err = typeof sp.error === "string" ? sp.error : null;

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL to edit products.
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/provider/products/${id}/edit`);

  const db = getDb();
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));
  if (!acct) redirect("/provider/onboarding");

  const [product] = await db.select().from(providerProducts).where(eq(providerProducts.id, id));
  if (!product || product.providerAccountId !== acct.id) notFound();

  const meta =
    product.endpointMetadata && typeof product.endpointMetadata === "object"
      ? (product.endpointMetadata as Record<string, unknown>)
      : {};
  const invokePathRaw = metaString(meta, "invoke_path") || metaString(meta, "invokePath") || "/invoke";

  const catalog = await listCatalogServiceIds();

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <p className="text-xs text-zinc-500">
        <Link href="/provider/products" className="text-amber-500 hover:underline">
          ← My services
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold text-white">Edit listing</h1>
      <p className="mt-2 max-w-3xl text-base text-zinc-300">
        Fix service ID and base URL if buyers see errors. For a self-hosted agent, use a unique service ID and{" "}
        <span className="font-mono text-amber-200/90">http_external</span> with your HTTPS origin.
      </p>
      {err ? (
        <p className="mt-4 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {err}
        </p>
      ) : null}

      <section className="mt-8 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-lg">
        <h2 className="text-base font-semibold text-white">{product.title}</h2>
        <ProviderProductForm
          catalog={catalog}
          action={updateProviderProduct}
          mode="edit"
          productId={product.id}
          initial={{
            linkedServiceId: product.linkedServiceId ?? "",
            title: product.title,
            description: product.description,
            type: product.type,
            priceSats: product.priceSats ?? 100,
            baseUrl: metaString(meta, "base_url") || metaString(meta, "baseUrl"),
            invokePath: invokePathRaw.startsWith("/") ? invokePathRaw : `/${invokePathRaw}`,
            headersJson: headersJsonFromMeta(meta),
          }}
        />
      </section>
    </main>
  );
}
