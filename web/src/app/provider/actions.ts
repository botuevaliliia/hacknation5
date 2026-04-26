"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const linkedServiceId = String(formData.get("linked_service_id") ?? "").trim();
  const priceSats = Number(formData.get("price_sats"));
  if (!title || !description || !linkedServiceId) {
    redirect("/provider/products?error=Missing+fields");
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
  });

  revalidatePath("/dashboard/market");
  revalidatePath("/provider/products");
  redirect("/provider/products");
}

export async function listCatalogServiceIds(): Promise<{ serviceId: string; name: string }[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({ serviceId: agentServices.serviceId, name: agentServices.name })
    .from(agentServices)
    .where(eq(agentServices.active, 1));
  return rows;
}
