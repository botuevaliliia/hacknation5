import { redirect } from "next/navigation";
import Link from "next/link";
import { ensureProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user = null as { id: string; email?: string | null } | null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    redirect("/auth/login?error=Supabase+not+configured");
  }
  if (!user) {
    redirect("/auth/login?next=/dashboard/market");
  }
  await ensureProfile(user.id, user.email);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3 text-sm text-zinc-300">
          <span className="font-semibold text-zinc-100">Buyer</span>
          <Link href="/dashboard/market" className="hover:text-white">
            Market
          </Link>
          <Link href="/dashboard/orders" className="hover:text-white">
            Orders
          </Link>
          <Link href="/dashboard/spend" className="hover:text-white">
            Spend
          </Link>
          <Link href="/dashboard/wallet" className="hover:text-white">
            Wallet
          </Link>
          <Link href="/dashboard/agents" className="hover:text-white">
            Agents
          </Link>
          <Link href="/provider" className="ml-auto text-zinc-200 hover:text-white">
            Provider portal →
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
