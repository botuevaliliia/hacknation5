import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { eq } from "drizzle-orm";
import { MarketplaceBuyButton } from "@/components/marketplace-buy-button";
import { platformFeeSats, totalCheckoutSats } from "@/lib/platform-fee";

const { listings } = schema;

export const dynamic = "force-dynamic";

function Stars({ n }: { n: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(n / 20)));
  return (
    <span className="text-amber-500/80" aria-label={`Reputation ${n}`}>
      {"★".repeat(filled)}
      <span className="text-zinc-600">{"★".repeat(5 - filled)}</span>{" "}
      <span className="ml-1 text-sm text-zinc-500">({n}/100)</span>
    </span>
  );
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
        <p className="text-sm text-zinc-500">Database not configured.</p>
        <Link href="/marketplace" className="mt-2 inline-block text-amber-500 text-sm">
          ← Marketplace
        </Link>
      </main>
    );
  }
  const { id } = await params;
  const db = getDb();
  const [row] = await db.select().from(listings).where(eq(listings.id, id));
  if (!row) {
    notFound();
  }

  const fee = platformFeeSats(row.priceSats);
  const total = totalCheckoutSats(row.priceSats);

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <Link href="/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Marketplace
      </Link>
      <article className="mt-6 max-w-2xl">
        <h1 className="text-2xl font-semibold text-zinc-100">{row.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
          <span>{row.sellerLabel}</span>
          <Stars n={row.reputation} />
        </div>
        <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
          {row.description}
        </p>
        {row.serviceUrl && (
          <p className="mt-4 text-sm">
            <span className="text-zinc-500">Service URL: </span>
            <a
              className="text-amber-500 hover:underline"
              href={row.serviceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {row.serviceUrl}
            </a>
          </p>
        )}

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-medium text-zinc-300">Hire with Lightning (Muun, etc.)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Platform takes {fee} sats (min 5 or 5% of listing) on top of the {row.priceSats} sats
            listing. Total: <strong className="text-zinc-400">{total} sats</strong>.
          </p>
          <div className="mt-4">
            <MarketplaceBuyButton
              listingId={row.id}
              title={row.title}
              description={row.description}
              priceSats={row.priceSats}
              sellerLabel={row.sellerLabel}
            />
          </div>
        </div>
      </article>
    </main>
  );
}
