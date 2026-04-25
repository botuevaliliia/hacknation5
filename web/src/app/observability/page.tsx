import { loadObservabilitySnapshot } from "@/marketplace/observability-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
  const data = await loadObservabilitySnapshot();

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        <p>Connect DATABASE_URL to see ranking events, invocations, and reputation.</p>
        <Link href="/" className="mt-4 inline-block text-amber-500">
          ← Home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Observability (read-only)</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Human-facing trace: no actions here. Agents use{" "}
          <code className="text-zinc-400">POST /api/v1/discover|invoke|feedback</code> with{" "}
          <code className="text-zinc-400">AGENT_API_KEY</code>.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-amber-500/90">Catalog (agent services)</h2>
        <ul className="mt-3 space-y-2 text-xs text-zinc-400">
          {data.services.map((s) => (
            <li key={s.serviceId} className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
              <span className="text-zinc-200">{s.name}</span>{" "}
              <span className="text-zinc-600">({s.serviceId})</span> · {s.adapterType} · seed trust{" "}
              {s.trustScoreSeed}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-amber-500/90">Reputation snapshots</h2>
        <ul className="mt-3 space-y-2 text-xs text-zinc-400">
          {data.reputation.length === 0 ? (
            <li className="text-zinc-600">No reputation updates yet (feedback creates rows).</li>
          ) : (
            data.reputation.map((r) => (
              <li key={r.serviceId} className="font-mono">
                {r.serviceId} · trust {r.trustScore.toFixed(3)} · {r.snapshotId}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-amber-500/90">Ranking events</h2>
        <ul className="mt-3 space-y-3 text-xs">
          {data.rankingLogs.map((e) => (
            <li
              key={e.rankingEventId}
              className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-400"
            >
              <div className="text-zinc-300">{e.rankingEventId}</div>
              <div className="mt-1">Task: {e.task}</div>
              <div>
                Mode: {e.rankerMode} · model: {e.modelId} · budget ${e.budgetUsd}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-amber-500/90">Transactions</h2>
        <ul className="mt-3 space-y-3 text-xs">
          {data.transactions.length === 0 ? (
            <li className="text-zinc-600">No invocations yet.</li>
          ) : (
            data.transactions.map((t) => (
              <li
                key={t.id}
                className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-400"
              >
                <div className="font-mono text-zinc-300">{t.id}</div>
                <div>service {t.serviceId} · agent {t.agentId}</div>
                <div>status: {t.status}</div>
                <div className="mt-1 max-h-24 overflow-auto text-zinc-500">
                  {JSON.stringify(t.resultJson ?? {}, null, 0).slice(0, 400)}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
