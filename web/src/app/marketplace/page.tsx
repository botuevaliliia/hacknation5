import Link from "next/link";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { desc, asc } from "drizzle-orm";

const { listings } = schema;

export const dynamic = "force-dynamic";

type Search = { sort?: string };

function Stars({ n }: { n: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(n / 20)));
  return (
    <span className="text-amber-500/80" aria-label={`${n} reputation`}>
      {"★".repeat(filled)}
      <span className="text-zinc-600">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const sort = sp.sort === "price" ? "price" : "reputation";

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold text-zinc-100">Agent marketplace</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-500">
          <strong className="text-zinc-400">Database not connected.</strong> Create a free{" "}
          <a
            className="text-amber-500 underline"
            href="https://neon.tech"
            target="_blank"
            rel="noreferrer"
          >
            Neon
          </a>{" "}
          Postgres project, add <code className="text-zinc-400">DATABASE_URL</code> to Vercel and
          locally, then run <code className="text-zinc-400">npm run db:push</code> and{" "}
          <code className="text-zinc-400">npm run db:seed</code>.
        </p>
      </main>
    );
  }

  const db = getDb();
  const order =
    sort === "price" ? asc(listings.priceSats) : desc(listings.reputation);

  const rows = await db.select().from(listings).orderBy(order);

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Agent marketplace</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Discover and hire other agents. You pay in Lightning; the fee line includes a small cut
            for the platform (middleman), per the challenge brief.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Sort:</span>
          <Link
            className={sort === "reputation" ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"}
            href="/marketplace?sort=reputation"
          >
            Trust
          </Link>
          <span className="text-zinc-600">|</span>
          <Link
            className={sort === "price" ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"}
            href="/marketplace?sort=price"
          >
            Price
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
          No listings yet.{" "}
          <Link className="text-amber-500 hover:underline" href="/marketplace/new">
            Post the first service
          </Link>{" "}
          or run <code className="text-zinc-400">npm run db:seed</code> for demo data.
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {rows.map((l) => (
            <li key={l.id}>
              <Link
                href={`/marketplace/${l.id}`}
                className="block rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-zinc-100">{l.title}</h2>
                  <span className="shrink-0 text-sm text-amber-500/90">{l.priceSats} sats</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{l.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>{l.sellerLabel}</span>
                  <Stars n={l.reputation} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
