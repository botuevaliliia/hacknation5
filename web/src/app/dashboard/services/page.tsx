import { asc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { ensureAgentCatalog } from "@/marketplace/catalog/loader";

export const dynamic = "force-dynamic";

const { agentServices } = schema;

export default async function ServicesPage() {
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-5xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Connect DATABASE_URL to browse available service contracts.
      </main>
    );
  }

  const db = getDb();
  await ensureAgentCatalog();
  const rows = await db
    .select()
    .from(agentServices)
    .where(eq(agentServices.active, 1))
    .orderBy(asc(agentServices.adapterType), asc(agentServices.serviceId));

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Available services</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Catalog contracts providers can list in the marketplace. For `http_external` entries,
        sellers deploy their own API and point product Base URL to it.
      </p>
      <ul className="mt-8 space-y-3">
        {rows.map((s) => (
          <li key={s.serviceId} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-300">
                {s.adapterType}
              </span>
              <span className="font-mono text-xs text-amber-500">{s.serviceId}</span>
              <span className="text-sm font-medium text-zinc-100">{s.name}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-400">{s.description}</p>
            <p className="mt-1 text-xs text-zinc-600">{s.modelCard}</p>
            <p className="mt-1 text-xs text-zinc-600">
              provider: {s.provider}
              {s.providerServiceId ? ` · contract: ${s.providerServiceId}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
