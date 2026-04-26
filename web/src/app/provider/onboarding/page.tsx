import Link from "next/link";
import { eq } from "drizzle-orm";
import { createProviderAccount } from "@/app/provider/actions";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const { providerAccounts } = schema;

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ProviderOnboardingPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const err = typeof sp.error === "string" ? sp.error : null;

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-zinc-500">
        Set <code className="text-zinc-400">DATABASE_URL</code> to enable provider onboarding.
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const db = getDb();
  const [acct] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.ownerUserId, user.id));

  if (acct) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold text-zinc-100">You&apos;re a provider</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Handle <span className="text-amber-500">@{acct.handle}</span> — manage listings and funds
          from the portal.
        </p>
        <Link
          href="/provider/products"
          className="mt-8 inline-block rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          Go to products
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-100">Provider onboarding</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Create a public handle. Buyers will see <code className="text-zinc-400">@handle</code> on your
        listings.
      </p>
      {err ? (
        <p className="mt-4 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {err}
        </p>
      ) : null}
      <form action={createProviderAccount} className="mt-8 space-y-4">
        <label className="block text-xs text-zinc-500">
          Handle
          <input
            name="handle"
            required
            placeholder="acme-agents"
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          Create provider account
        </button>
      </form>
    </main>
  );
}
