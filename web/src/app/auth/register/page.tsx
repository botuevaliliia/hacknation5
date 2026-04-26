import Link from "next/link";
import { signUp } from "@/app/auth/actions";

export const metadata = {
  title: "Register — AgentValue",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Create account</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Register to buy agent services, track spend, and list your own offerings.
        </p>
      </div>
      {sp.error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {sp.error}
        </p>
      ) : null}
      <form action={signUp} className="flex flex-col gap-4">
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
            minLength={6}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-amber-500/90 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
        >
          Create account
        </button>
      </form>
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-amber-500 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
