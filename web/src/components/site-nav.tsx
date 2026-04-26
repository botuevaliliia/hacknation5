import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteNav() {
  let user: { email?: string | null } | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-sm font-medium tracking-tight text-zinc-100">
          AgentValue
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <Link href="/marketplace" className="hover:text-zinc-300">
            Marketplace
          </Link>
          <Link href="/observability" className="hover:text-zinc-300">
            Observability
          </Link>
          {user ? (
            <>
              <span className="rounded-full border border-emerald-900/50 bg-emerald-950/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                Signed in
              </span>
              <Link href="/dashboard/market" className="hover:text-amber-400">
                Buyer dashboard
              </Link>
              <Link href="/dashboard/wallet" className="hover:text-amber-400">
                Wallet
              </Link>
              <Link href="/provider" className="hover:text-amber-400">
                Provider
              </Link>
              <span className="max-w-[160px] truncate text-zinc-600" title={user.email ?? ""}>
                {user.email}
              </span>
              <form action={signOut} className="inline">
                <button
                  type="submit"
                  className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hover:text-zinc-300">
                Sign in
              </Link>
              <Link href="/auth/register" className="hover:text-zinc-300">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
