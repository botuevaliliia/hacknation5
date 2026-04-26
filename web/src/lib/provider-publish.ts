import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ensureAgentCatalog } from "@/marketplace/catalog/loader";

const { providerAccounts, providerProducts, agentServices, profiles } = schema;

export type ProviderProductPublishInput = {
  title: string;
  description: string;
  type: string;
  priceSats: number;
  linkedServiceIdRaw: string;
  baseUrl: string;
  invokePathRaw: string;
  headers?: Record<string, string>;
};

export function slugServiceId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.slice(0, 64) || "service_v1";
}

function slugHandle(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s.slice(0, 32) || "provider";
}

export type AppDb = ReturnType<typeof getDb>;

export type PublishProviderProductResult =
  | { ok: true; product: typeof providerProducts.$inferSelect }
  | { ok: false; status: number; error: Record<string, unknown> };

export type UpdateProviderProductInput = {
  productId: string;
  title?: string;
  description?: string;
  type?: string;
  priceSats?: number;
  linkedServiceIdRaw?: string;
  baseUrl?: string;
  invokePathRaw?: string;
  headers?: Record<string, string>;
  active?: number;
};

export type UpdateProviderProductResult =
  | { ok: true; product: typeof providerProducts.$inferSelect }
  | { ok: false; status: number; error: Record<string, unknown> };

/**
 * Ensures a provider_accounts row exists for this auth user (API / agent automation).
 */
export async function ensureProviderAccountForUser(
  db: AppDb,
  ownerUserId: string,
  emailHint?: string | null,
): Promise<typeof providerAccounts.$inferSelect> {
  const [existing] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, ownerUserId));
  if (existing) return existing;

  const baseFromEmail = emailHint?.split("@")[0] ?? "";
  let handle = slugHandle(baseFromEmail ? `agent-${baseFromEmail}` : `agent-${ownerUserId.replace(/-/g, "").slice(0, 12)}`);
  if (!handle || handle === "provider") {
    handle = slugHandle(`agent-${ownerUserId.replace(/-/g, "").slice(0, 12)}`);
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await db.insert(providerAccounts).values({
        ownerUserId,
        handle: attempt === 0 ? handle : slugHandle(`${handle}-${attempt}`),
        status: "active",
      });
      await db.update(profiles).set({ isProvider: 1 }).where(eq(profiles.userId, ownerUserId));
      const [row] = await db.select().from(providerAccounts).where(eq(providerAccounts.ownerUserId, ownerUserId));
      if (!row) throw new Error("provider insert race");
      return row;
    } catch {
      const [race] = await db
        .select()
        .from(providerAccounts)
        .where(eq(providerAccounts.ownerUserId, ownerUserId));
      if (race) return race;
    }
  }
  throw new Error("Could not allocate a unique provider handle");
}

export async function publishProviderProductForOwner(
  db: AppDb,
  ownerUserId: string,
  input: ProviderProductPublishInput,
): Promise<PublishProviderProductResult> {
  const title = input.title.trim();
  const description = input.description.trim();
  const linkedRaw = input.linkedServiceIdRaw.trim();
  const linkedServiceId = slugServiceId(linkedRaw);
  const type = input.type.trim() || "agent";
  const baseUrl = input.baseUrl.trim();
  const invokePathRaw = input.invokePathRaw.trim() || "/invoke";
  const invokePath = invokePathRaw.startsWith("/") ? invokePathRaw : `/${invokePathRaw}`;
  const priceSats = input.priceSats;

  if (!title || !description || !linkedRaw) {
    return {
      ok: false,
      status: 400,
      error: { message: "title, description, linked_service_id required" },
    };
  }

  await ensureAgentCatalog();

  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, ownerUserId));
  if (!acct) {
    return {
      ok: false,
      status: 404,
      error: {
        code: "provider_required",
        message:
          "No provider account for this user. Call POST /api/provider/products/me (auto-provisions) or complete /provider/onboarding once.",
      },
    };
  }

  let [svc] = await db.select().from(agentServices).where(eq(agentServices.serviceId, linkedServiceId));
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
    [svc] = await db.select().from(agentServices).where(eq(agentServices.serviceId, linkedServiceId));
  }

  if (!baseUrl) {
    return {
      ok: false,
      status: 400,
      error: { message: "base_url required (public deployed service origin)" },
    };
  }

  const endpointMetadata: Record<string, unknown> = { base_url: baseUrl };
  if (invokePath !== "/invoke") endpointMetadata.invoke_path = invokePath;
  if (input.headers && typeof input.headers === "object" && !Array.isArray(input.headers)) {
    endpointMetadata.headers = input.headers;
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

  return { ok: true, product };
}

export async function listProviderProductsForOwner(db: AppDb, ownerUserId: string) {
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, ownerUserId));
  if (!acct) return [];
  const rows = await db
    .select()
    .from(providerProducts)
    .where(eq(providerProducts.providerAccountId, acct.id));
  return rows;
}

export async function updateProviderProductForOwner(
  db: AppDb,
  ownerUserId: string,
  input: UpdateProviderProductInput,
): Promise<UpdateProviderProductResult> {
  const productId = input.productId.trim();
  if (!productId) {
    return { ok: false, status: 400, error: { message: "product_id required" } };
  }
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, ownerUserId));
  if (!acct) {
    return { ok: false, status: 404, error: { message: "Provider account not found for user" } };
  }

  const [existing] = await db.select().from(providerProducts).where(eq(providerProducts.id, productId));
  if (!existing || existing.providerAccountId !== acct.id) {
    return { ok: false, status: 404, error: { message: "Product not found for this user" } };
  }

  const nextTitle = input.title?.trim() ?? existing.title;
  const nextDescription = input.description?.trim() ?? existing.description;
  const nextType = (input.type?.trim() || existing.type || "agent").trim();
  const nextLinkedRaw = input.linkedServiceIdRaw?.trim() ?? (existing.linkedServiceId ?? "");
  const nextLinkedServiceId = slugServiceId(nextLinkedRaw);
  const nextBaseUrl = input.baseUrl?.trim();
  const nextInvokePathRaw = input.invokePathRaw?.trim();
  const nextPrice = input.priceSats;

  if (!nextTitle || !nextDescription || !nextLinkedRaw) {
    return {
      ok: false,
      status: 400,
      error: { message: "title, description, linked_service_id required" },
    };
  }

  const existingMeta =
    existing.endpointMetadata && typeof existing.endpointMetadata === "object"
      ? (existing.endpointMetadata as Record<string, unknown>)
      : {};
  const currentBase = String(existingMeta.base_url ?? existingMeta.baseUrl ?? "");
  const currentInvokePath = String(existingMeta.invoke_path ?? existingMeta.invokePath ?? "/invoke") || "/invoke";
  const currentHeadersRaw = existingMeta.headers;
  const currentHeaders =
    currentHeadersRaw && typeof currentHeadersRaw === "object" && !Array.isArray(currentHeadersRaw)
      ? (currentHeadersRaw as Record<string, string>)
      : {};

  const baseUrl = nextBaseUrl ?? currentBase;
  if (!baseUrl.trim()) {
    return {
      ok: false,
      status: 400,
      error: { message: "base_url required (public deployed service origin)" },
    };
  }
  const invokePath = nextInvokePathRaw
    ? (nextInvokePathRaw.startsWith("/") ? nextInvokePathRaw : `/${nextInvokePathRaw}`)
    : currentInvokePath.startsWith("/")
      ? currentInvokePath
      : `/${currentInvokePath}`;
  const headers = input.headers ?? currentHeaders;

  await ensureAgentCatalog();
  let [svc] = await db
    .select()
    .from(agentServices)
    .where(eq(agentServices.serviceId, nextLinkedServiceId));
  if (!svc) {
    await db.insert(agentServices).values({
      serviceId: nextLinkedServiceId,
      name: nextTitle,
      provider: `provider:${acct.handle}`,
      providerServiceId: nextLinkedServiceId,
      adapterType: "http_external",
      capabilities: [nextType, "api_published"],
      description: nextDescription,
      modelCard: "API-published external service contract",
      estimatedBaseCostUsd: 0,
      vetted: 1,
      active: 1,
      trustScoreSeed: 0.7,
    });
    [svc] = await db
      .select()
      .from(agentServices)
      .where(eq(agentServices.serviceId, nextLinkedServiceId));
  }

  const endpointMetadata: Record<string, unknown> = { base_url: baseUrl.trim() };
  if (invokePath !== "/invoke") endpointMetadata.invoke_path = invokePath;
  if (headers && Object.keys(headers).length > 0) endpointMetadata.headers = headers;

  const [updated] = await db
    .update(providerProducts)
    .set({
      title: nextTitle,
      description: nextDescription,
      type: ["agent", "dataset", "mcp_server"].includes(nextType) ? nextType : "agent",
      priceSats:
        Number.isFinite(nextPrice) && Number(nextPrice) >= 0
          ? Math.floor(Number(nextPrice))
          : existing.priceSats ?? 100,
      linkedServiceId: nextLinkedServiceId,
      endpointMetadata,
      active: input.active === 0 ? 0 : 1,
    })
    .where(eq(providerProducts.id, productId))
    .returning();

  return { ok: true, product: updated };
}
