"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const { profiles, providerAccounts } = schema;

function normalizeLightningAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function saveLightningAddress(formData: FormData) {
  const addressRaw = String(formData.get("lightning_address") ?? "");
  const next = "/dashboard/wallet";

  if (!isDatabaseConfigured()) {
    redirect(`${next}?error=Database+not+configured`);
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/dashboard/wallet");

  const db = getDb();
  const normalized = normalizeLightningAddress(addressRaw);

  if (normalized && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    redirect(`${next}?error=Use+a+valid+Lightning+Address+like+name%40domain.com`);
  }

  await db
    .update(profiles)
    .set({ lightningAddress: normalized || null })
    .where(eq(profiles.userId, user.id));

  const [provider] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));

  if (provider) {
    const existing = (provider.payoutPrefsJson ?? {}) as Record<string, unknown>;
    const nextPrefs = { ...existing };
    if (normalized) {
      nextPrefs.lightningAddress = normalized;
    } else {
      delete nextPrefs.lightningAddress;
    }
    await db
      .update(providerAccounts)
      .set({ payoutPrefsJson: Object.keys(nextPrefs).length ? nextPrefs : null })
      .where(eq(providerAccounts.id, provider.id));
  }

  revalidatePath("/dashboard/wallet");
  revalidatePath("/provider/funds");
  redirect("/dashboard/wallet?saved=1");
}
