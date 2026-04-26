"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const { profiles, providerAccounts } = schema;

function normalizePayoutAddress(raw: string): string {
  return raw.trim();
}

function isLightningAddress(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function isBitcoinAddress(value: string): boolean {
  // Accept common base58 and bech32 families for mainnet/testnet/regtest.
  return (
    /^(bc1|tb1|bcrt1)[a-z0-9]{8,87}$/i.test(value) ||
    /^(1|3|m|n|2)[a-km-zA-HJ-NP-Z1-9]{20,62}$/.test(value)
  );
}

function isBolt11Invoice(value: string): boolean {
  return /^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value);
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
  const normalized = normalizePayoutAddress(addressRaw);

  if (
    normalized &&
    !isLightningAddress(normalized) &&
    !isBitcoinAddress(normalized) &&
    !isBolt11Invoice(normalized)
  ) {
    redirect(
      `${next}?error=Use+a+valid+Lightning+Address%2C+Bitcoin+address%2C+or+BOLT11+invoice`,
    );
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
