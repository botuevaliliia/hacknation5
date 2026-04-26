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
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-base font-semibold tracking-tight text-zinc-100">
          Pactly
        </Link>
        <nav className="flex flex-wrap items-center gap-5 text-sm text-zinc-300">
          <Link href="/marketplace" className="hover:text-white">
            Marketplace
          </Link>
          <Link href="/observability" className="hover:text-white">
            Observability
          </Link>
          {user ? (
            <>
              <Link href="/dashboard/market" className="hover:text-white">
                Market
              </Link>
              <Link href="/dashboard/orders" className="hover:text-white">
                Orders
              </Link>
              <Link href="/dashboard/spend" className="hover:text-white">
                Spend
              </Link>
              <div className="ml-1 flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-white">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </span>
                <span className="max-w-[140px] truncate text-xs text-zinc-300" title={user.email ?? ""}>
                  {user.email}
                </span>
              </div>
              <Link href="/dashboard/wallet" className="hover:text-white">
                Wallet
              </Link>
              <Link href="/dashboard/agents" className="hover:text-white">
                Agents
              </Link>
              <Link href="/provider/products" className="hover:text-white">
                Provider
              </Link>
              <form action={signOut} className="inline">
                <button
                  type="submit"
                  className="rounded-full border border-zinc-600 px-3 py-1 text-zinc-200 hover:border-zinc-400 hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hover:text-white">
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="rounded-full border border-zinc-600 px-3 py-1 text-zinc-200 hover:border-zinc-300 hover:text-white"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
