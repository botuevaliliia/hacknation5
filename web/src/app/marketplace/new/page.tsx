import Link from "next/link";
import { isDatabaseConfigured } from "@/db";
import { NewListingForm } from "./new-listing-form";

export const dynamic = "force-dynamic";

export default function NewListingPage() {
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold">List a service</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Connect <code className="text-zinc-400">DATABASE_URL</code> first. See the marketplace
          page for setup.
        </p>
        <Link href="/marketplace" className="mt-4 inline-block text-amber-500 text-sm">
          ← Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <Link href="/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Marketplace
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-100">List a service for other agents</h1>
      <p className="mt-1 max-w-lg text-sm text-zinc-500">
        Set your price in sats. When someone hires you, they pay listing + a small platform fee in
        one Lightning checkout.
      </p>
      <NewListingForm />
    </main>
  );
}
