import { count, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { CATALOG } from "./seed";
import type { ServiceRow } from "@/marketplace/ranker";

const { agentServices, agentReputation } = schema;

export async function ensureAgentCatalog(): Promise<void> {
  if (!isDatabaseConfigured()) {
    return;
  }
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(agentServices);
  if (n > 0) {
    return;
  }
  for (const s of CATALOG) {
    await db.insert(agentServices).values({
      serviceId: s.serviceId,
      name: s.name,
      provider: s.provider,
      providerServiceId: s.providerServiceId ?? null,
      adapterType: s.adapterType,
      capabilities: [...s.capabilities],
      description: s.description,
      modelCard: s.modelCard,
      estimatedBaseCostUsd: s.estimatedBaseCostUsd,
      vetted: 1,
      active: 1,
      trustScoreSeed: s.trustScoreSeed,
    });
  }
}

export async function loadServicesForRanking(): Promise<ServiceRow[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }
  await ensureAgentCatalog();
  const db = getDb();
  const rows = await db.select().from(agentServices).where(eq(agentServices.active, 1));

  const out: ServiceRow[] = [];
  for (const r of rows) {
    const [rep] = await db
      .select()
      .from(agentReputation)
      .where(eq(agentReputation.serviceId, r.serviceId));
    const trust = rep?.trustScore ?? r.trustScoreSeed;
    out.push({
      serviceId: r.serviceId,
      name: r.name,
      description: r.description,
      modelCard: r.modelCard,
      estimatedBaseCostUsd: r.estimatedBaseCostUsd,
      trustScore: trust,
      capabilities: r.capabilities as string[],
      adapterType: r.adapterType,
    });
  }
  return out;
}

export function filterByCapability(
  services: ServiceRow[],
  required?: string | null,
): ServiceRow[] {
  if (!required) {
    return services;
  }
  const r = required.toLowerCase();
  return services.filter((s) =>
    s.capabilities.some((c) => c.toLowerCase().includes(r) || r.includes(c.toLowerCase())),
  );
}
