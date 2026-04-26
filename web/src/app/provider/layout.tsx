import { redirect } from "next/navigation";
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

  return <div className="flex flex-1 flex-col">{children}</div>;
}
