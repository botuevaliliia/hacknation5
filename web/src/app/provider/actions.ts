"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAgentCatalog } from "@/marketplace/catalog/loader";

const { profiles, providerAccounts, providerProducts, agentServices } = schema;

function slugHandle(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s.slice(0, 32) || "provider";
}

function slugServiceId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.slice(0, 64) || "service_v1";
}

export async function createProviderAccount(formData: FormData) {
  if (!isDatabaseConfigured()) {
    redirect("/provider/onboarding?error=Database+not+configured");
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider/onboarding");

  const handle = slugHandle(String(formData.get("handle") ?? ""));
  const db = getDb();
  const [existing] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));
  if (existing) {
    redirect("/provider/products?error=Already+a+provider");
  }

  try {
    await db.insert(providerAccounts).values({
      ownerUserId: user.id,
      handle,
      status: "active",
    });
    await db.update(profiles).set({ isProvider: 1 }).where(eq(profiles.userId, user.id));
  } catch {
    redirect("/provider/onboarding?error=Handle+may+already+exist");
  }
  revalidatePath("/provider", "layout");
  redirect("/provider/products");
}

export async function createProviderProduct(formData: FormData) {
  if (!isDatabaseConfigured()) {
    redirect("/provider/products?error=Database+not+configured");
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider/products");

  const db = getDb();
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));
  if (!acct) redirect("/provider/onboarding");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "agent").trim();
  const linkedServiceId = slugServiceId(String(formData.get("linked_service_id") ?? ""));
  const priceSats = Number(formData.get("price_sats"));
  if (!title || !description || !linkedServiceId) {
    redirect("/provider/products?error=Missing+fields");
  }

  let [svc] = await db
    .select()
    .from(agentServices)
    .where(eq(agentServices.serviceId, linkedServiceId));

  const baseUrl = String(formData.get("base_url") ?? "").trim();
  const invokePathRaw = String(formData.get("invoke_path") ?? "/invoke").trim() || "/invoke";
  const invokePath = invokePathRaw.startsWith("/") ? invokePathRaw : `/${invokePathRaw}`;
  let headers: Record<string, string> = {};
  try {
    const hj = String(formData.get("headers_json") ?? "{}").trim();
    const parsed = JSON.parse(hj || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      headers = parsed as Record<string, string>;
    }
  } catch {
    redirect("/provider/products?error=headers_json+must+be+valid+JSON+object");
  }

  if ((!svc || svc.adapterType === "http_external") && !baseUrl) {
    redirect("/provider/products?error=HTTP+agents+require+Base+URL+%28your+deployed+origin%29");
  }

  const endpointMetadata: Record<string, unknown> = {};
  if (baseUrl) endpointMetadata.base_url = baseUrl;
  if (invokePath !== "/invoke") endpointMetadata.invoke_path = invokePath;
  if (Object.keys(headers).length > 0) endpointMetadata.headers = headers;

  if (!svc) {
    await db.insert(agentServices).values({
      serviceId: linkedServiceId,
      name: title,
      provider: `provider:${acct.handle}`,
      providerServiceId: linkedServiceId,
      adapterType: "http_external",
      capabilities: [type, "user_published"],
      description,
      modelCard: "User-published external API contract",
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

  await db.insert(providerProducts).values({
    providerAccountId: acct.id,
    type: ["agent", "dataset", "mcp_server"].includes(type) ? type : "agent",
    title,
    description,
    priceSats: Number.isFinite(priceSats) && priceSats >= 0 ? Math.floor(priceSats) : 100,
    pricingModel: "per_call",
    linkedServiceId,
    active: 1,
    endpointMetadata,
  });

  revalidatePath("/dashboard/market");
  revalidatePath("/provider/products");
  redirect("/provider/products");
}

export type CatalogServiceOption = {
  serviceId: string;
  name: string;
  adapterType: string;
  description: string;
  provider: string;
  providerServiceId: string | null;
  modelCard: string;
};

export async function listCatalogServiceIds(): Promise<CatalogServiceOption[]> {
  if (!isDatabaseConfigured()) return [];
  await ensureAgentCatalog();
  const db = getDb();
  const rows = await db
    .select({
      serviceId: agentServices.serviceId,
      name: agentServices.name,
      adapterType: agentServices.adapterType,
      description: agentServices.description,
      provider: agentServices.provider,
      providerServiceId: agentServices.providerServiceId,
      modelCard: agentServices.modelCard,
    })
    .from(agentServices)
    .where(eq(agentServices.active, 1));
  return rows;
}
