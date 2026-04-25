"use client";

import { useCheckout } from "@moneydevkit/nextjs";
import { useState } from "react";

export function PurchaseCta() {
  const { createCheckout, isLoading } = useCheckout();
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    setError(null);
    const result = await createCheckout({
      type: "AMOUNT",
      title: "Agent Economy demo — Lightning credits",
      description: "One small Lightning payment to prove value movement (Hack-Nation / Spiral).",
      amount: 100,
      currency: "SAT",
      successUrl: "/checkout/success",
      metadata: {
        product: "demo-credits-100sats",
      },
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    window.location.href = result.data.checkoutUrl;
  };

  return (
    <div className="flex flex-col items-start gap-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handlePurchase}
        disabled={isLoading}
        className="inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
      >
        {isLoading ? "Creating checkout…" : "Pay 100 sats (demo)"}
      </button>
      <p className="text-xs text-zinc-500">Opens MDK hosted checkout; completes in Lightning.</p>
    </div>
  );
}
