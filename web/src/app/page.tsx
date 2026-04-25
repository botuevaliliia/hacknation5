import { PurchaseCta } from "@/components/purchase-cta";

const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <span className="text-sm font-medium tracking-tight text-zinc-100">AgentValue</span>
          <span className="text-xs text-zinc-500">Lightning · L402 · MDK</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-16">
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-widest text-amber-500/90">
            Spiral × Hack-Nation
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
            A tiny economy where value moves on Lightning
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-400">
            This base implements two payment surfaces from the challenge brief: a hosted checkout for
            humans and wallets, and an HTTP-402 (L402) pay-per-call API for programs and agents—both
            on the Lightning Network via MoneyDevKit.
          </p>
        </section>

        <section className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Per-call API (L402)</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Agents request <code className="text-zinc-300">/api/v1/insight</code>, pay the
              returned invoice, then retry with the credential and preimage. No API keys, no
              accounts—just machine-runnable money.
            </p>
            <div className="mt-4 rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-300 overflow-x-auto">
              curl -s {base}/api/v1/insight
            </div>
            <p className="mt-2 text-xs text-zinc-600">Expect 402, then pay and retry with Authorization: L402 …</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Checkout (humans & demos)</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Use a button flow to create a session, show the standard MDK payment UI, and land on
              success with verifiable payment state—good for “money actually moved” in judging.
            </p>
            <div className="mt-4">
              <PurchaseCta />
            </div>
          </div>
        </section>

        <section className="space-y-3 border-t border-zinc-800 pt-10">
          <h2 className="text-sm font-medium text-zinc-300">Next ideas (on top of this base)</h2>
          <ul className="list-inside list-disc space-y-2 text-sm text-zinc-500">
            <li>Reputation or escrow for multi-agent jobs</li>
            <li>Router marketplace that takes a cut of routed agent-to-agent work</li>
            <li>Human-in-the-loop tasks paid per judgment</li>
            <li>Dynamic pricing: charge more when load is high (already supported in MDK with an amount function)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
