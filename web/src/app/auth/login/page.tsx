import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/app/auth/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign in — Pactly",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard/market?info=already_signed_in");
    }
  } catch {
    // continue rendering login with explicit error from action if needed
  }
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Access your buyer dashboard, provider portal, wallet, and marketplace publishing.
        </p>
      </div>
      {sp.error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {sp.error}
        </p>
      ) : null}
      <form action={signIn} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={sp.next ?? "/dashboard/market"} />
        <label className="block text-sm">
          <span className="text-zinc-400">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-amber-500/90 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
        >
          Sign in
        </button>
      </form>
      <p className="text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/auth/register" className="text-amber-500 hover:underline">
          Register
        </Link>
      </p>
    </main>
  );
}
