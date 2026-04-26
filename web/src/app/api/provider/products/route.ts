import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { requireAgentOr401 } from "@/lib/agent-auth";
import { ensureAgentCatalog } from "@/marketplace/catalog/loader";

export const dynamic = "force-dynamic";

const { providerAccounts, providerProducts, agentServices } = schema;

function slugServiceId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.slice(0, 64) || "service_v1";
}

export async function POST(req: Request) {
  const denied = requireAgentOr401(req);
  if (denied) return denied;
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "database_required" } }, { status: 503 });
  }

  let body: {
    owner_user_id?: string;
    title?: string;
    description?: string;
    type?: string;
    price_sats?: number;
    linked_service_id?: string;
    base_url?: string;
    invoke_path?: string;
    headers?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const ownerUserId = String(body.owner_user_id ?? "").trim();
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const linkedServiceId = slugServiceId(String(body.linked_service_id ?? ""));
  const type = String(body.type ?? "agent").trim();
  const baseUrl = String(body.base_url ?? "").trim();
  const invokePathRaw = String(body.invoke_path ?? "/invoke").trim() || "/invoke";
  const invokePath = invokePathRaw.startsWith("/") ? invokePathRaw : `/${invokePathRaw}`;
  const priceSats = Number(body.price_sats);

  if (!ownerUserId || !title || !description || !linkedServiceId) {
    return Response.json(
      { error: { message: "owner_user_id, title, description, linked_service_id required" } },
      { status: 400 },
    );
  }

  await ensureAgentCatalog();
  const db = getDb();
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, ownerUserId));
  if (!acct) {
    return Response.json(
      {
        error: {
          message:
            "Provider account not found for owner_user_id. Onboard once in UI (/provider/onboarding) first.",
        },
      },
      { status: 404 },
    );
  }

  let [svc] = await db
    .select()
    .from(agentServices)
    .where(eq(agentServices.serviceId, linkedServiceId));
  if (!svc) {
    await db.insert(agentServices).values({
      serviceId: linkedServiceId,
      name: title,
      provider: `provider:${acct.handle}`,
      providerServiceId: linkedServiceId,
      adapterType: "http_external",
      capabilities: [type, "api_published"],
      description,
      modelCard: "API-published external service contract",
      estimatedBaseCostUsd: 0,
      vetted: 1,
      active: 1,
      trustScoreSeed: 0.7,
    });
    [svc] = await db
      .select()
      .from(agentServices)
      .where(eq(agentServices.serviceId, linkedServiceId));
  }

  if (!baseUrl) {
    return Response.json(
      { error: { message: "base_url required (public deployed service origin)" } },
      { status: 400 },
    );
  }

  const endpointMetadata: Record<string, unknown> = { base_url: baseUrl };
  if (invokePath !== "/invoke") endpointMetadata.invoke_path = invokePath;
  if (body.headers && typeof body.headers === "object" && !Array.isArray(body.headers)) {
    endpointMetadata.headers = body.headers;
  }

  const [product] = await db
    .insert(providerProducts)
    .values({
      providerAccountId: acct.id,
      type: ["agent", "dataset", "mcp_server"].includes(type) ? type : "agent",
      title,
      description,
      priceSats: Number.isFinite(priceSats) && priceSats >= 0 ? Math.floor(priceSats) : 100,
      pricingModel: "per_call",
      linkedServiceId,
      endpointMetadata,
      active: 1,
    })
    .returning();

  return Response.json({ ok: true, product });
}
