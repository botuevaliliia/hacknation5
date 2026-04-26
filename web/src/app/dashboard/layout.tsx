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
      <div className="border-b border-zinc-800 bg-zinc-950/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-3 text-xs text-zinc-400">
          <span className="font-medium text-zinc-200">Buyer</span>
          <Link href="/dashboard/market" className="hover:text-amber-400">
            Market
          </Link>
          <Link href="/dashboard/orders" className="hover:text-amber-400">
            Orders
          </Link>
          <Link href="/dashboard/spend" className="hover:text-amber-400">
            Spend
          </Link>
          <Link href="/dashboard/agents" className="hover:text-amber-400">
            Agents
          </Link>
          <Link href="/provider" className="ml-auto hover:text-zinc-200">
            Provider portal →
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
