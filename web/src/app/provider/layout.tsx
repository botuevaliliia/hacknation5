import { redirect } from "next/navigation";
import Link from "next/link";
import { ensureProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  let user = null as { id: string; email?: string | null } | null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    redirect("/auth/login?error=Supabase+not+configured");
  }
  if (!user) {
    redirect("/auth/login?next=/provider");
  }
  await ensureProfile(user.id, user.email);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3 text-sm text-zinc-300">
          <span className="font-semibold text-zinc-100">Provider</span>
          <Link href="/provider/onboarding" className="hover:text-white">
            Onboarding
          </Link>
          <Link href="/provider/products" className="hover:text-white">
            Products
          </Link>
          <Link href="/provider/analytics" className="hover:text-white">
            Analytics
          </Link>
          <Link href="/provider/funds" className="hover:text-white">
            Funds
          </Link>
          <Link href="/dashboard/services" className="hover:text-white">
            Service contracts
          </Link>
          <Link href="/dashboard/wallet" className="hover:text-white">
            Wallet
          </Link>
          <Link href="/dashboard/market" className="ml-auto text-zinc-200 hover:text-white">
            ← Buyer market
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
