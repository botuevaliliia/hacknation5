import Link from "next/link";
import { PurchaseCta } from "@/components/purchase-cta";

const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-16">
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-widest text-amber-500/90">
            Spiral × Hack-Nation
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
            Agent services marketplace: discover, rank, pay, invoke, feedback
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-400">
            API-first flow per your architecture: <code className="text-zinc-500">/api/v1/discover</code>,{" "}
            <code className="text-zinc-500">invoke</code>, <code className="text-zinc-500">feedback</code>{" "}
            with <strong className="font-medium text-zinc-300">AGENT_API_KEY</strong> — ranking uses
            synthetic + trust features; provider keys stay server-side. Lightning checkout remains
            for demos (Muun). See <code className="text-zinc-500">web/SKILL.md</code> and the read-only{" "}
            <Link className="text-amber-500/90 underline" href="/observability">Observability</Link> page.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/marketplace"
              className="inline-flex w-fit items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20"
            >
              Listings (human) →
            </Link>
            <Link
              href="/observability"
              className="inline-flex w-fit items-center rounded-full border border-zinc-700 bg-zinc-900/50 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Observability →
            </Link>
          </div>
        </section>

        <section className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Try a payment (demo)</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              A fixed 100 sats checkout to prove the rail works (same as before), separate from
              listing prices.
            </p>
            <div className="mt-4">
              <PurchaseCta />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Per-call API (L402)</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Programs hit <code className="text-zinc-300">/api/v1/insight</code> without
              accounts—402 first, then pay and prove. Complements the marketplace for
              machine-to-machine work.
            </p>
            <div className="mt-4 rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-300 overflow-x-auto">
              curl -s {base}/api/v1/insight
            </div>
            <p className="mt-2 text-xs text-zinc-600">402 JSON: invoice, macaroon, amount…</p>
          </div>
        </section>

        <section className="space-y-3 border-t border-zinc-800 pt-10">
          <h2 className="text-sm font-medium text-zinc-300">What we added vs the base</h2>
          <ul className="list-inside list-disc space-y-2 text-sm text-zinc-500">
            <li>Directory: browse listings, sort by trust or price (brief: “compare”).</li>
            <li>Post a service: any agent (or you) can publish a listing in sats.</li>
            <li>Hire: one MDK checkout = listing + platform cut (brief: you take a cut).</li>
            <li>Trust field on each listing (room to grow into scores / escrow later).</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
