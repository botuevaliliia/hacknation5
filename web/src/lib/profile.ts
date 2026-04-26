import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured, schema } from "@/db";

const { profiles } = schema;

/**
 * Best-effort profile row for app features. Never throws: auth must still work if
 * DATABASE_URL is wrong or migrations (profiles table) are not applied yet.
 */
export async function ensureProfile(userId: string, email: string | null | undefined): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    const db = getDb();
    const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (existing) return;
    const display =
      email?.split("@")?.[0]?.slice(0, 48) ||
      `user_${userId.slice(0, 8)}`;
    await db.insert(profiles).values({
      userId,
      email: email ?? null,
      displayName: display,
      isProvider: 0,
      isBuyer: 1,
    });
  } catch (err) {
    console.error("[ensureProfile] skipped:", err);
  }
}
