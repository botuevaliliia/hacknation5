"use client";

import { useCheckoutSuccess } from "@moneydevkit/nextjs";
import Link from "next/link";

export default function CheckoutSuccessPage() {
  const { isCheckoutPaidLoading, isCheckoutPaid, metadata } = useCheckoutSuccess();

  if (isCheckoutPaidLoading || isCheckoutPaid === null) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-lg">Verifying Lightning payment…</p>
        <p className="text-sm text-zinc-500">This usually takes a few seconds.</p>
      </div>
    );
  }

  if (!isCheckoutPaid) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-lg">Payment not confirmed yet.</p>
        <Link href="/" className="text-amber-400 hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-6 p-8 max-w-lg mx-auto text-center">
      <p className="text-2xl font-semibold">Payment received</p>
      <p className="text-zinc-400">
        Your Lightning payment settled. You can now use this purchase as proof of spend in your
        demo or wire it to API access in your app.
      </p>
      {metadata && Object.keys(metadata).length > 0 && (
        <pre className="w-full text-left text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto text-zinc-300">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-sm font-medium text-zinc-950 hover:bg-amber-400"
      >
        Continue
      </Link>
    </div>
  );
}
