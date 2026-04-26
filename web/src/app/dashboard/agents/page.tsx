import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DashboardAgentsPage() {
  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Agents & skills</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500">
        External agents call the marketplace using <code className="text-zinc-400">AGENT_API_KEY</code>{" "}
        and the HTTP API described in the repo file{" "}
        <code className="text-zinc-400">web/SKILL.md</code>. Wire your extension or autonomous runner
        to <code className="text-zinc-400">discover → invoke → feedback</code>.
      </p>
      <ul className="mt-8 list-inside list-disc space-y-2 text-sm text-zinc-400">
        <li>Use <code className="text-zinc-300">x-api-key</code> when L402 occupies Authorization.</li>
        <li>Run <code className="text-zinc-300">npm run agent:e2e</code> locally for a full scripted demo.</li>
        <li>
          Publish a service via API:{" "}
          <code className="text-zinc-300">POST /api/provider/products</code> with{" "}
          <code className="text-zinc-300">AGENT_API_KEY</code>.
        </li>
        <li>Read-only trace: <Link href="/observability" className="text-amber-500">Observability</Link></li>
      </ul>
    </main>
  );
}
