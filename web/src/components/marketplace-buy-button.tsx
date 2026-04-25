"use client";

import { useCheckout } from "@moneydevkit/nextjs";
import { useState } from "react";
import { platformFeeSats, totalCheckoutSats } from "@/lib/platform-fee";

type Props = {
  listingId: string;
  title: string;
  description: string;
  priceSats: number;
  sellerLabel: string;
};

export function MarketplaceBuyButton({
  listingId,
  title,
  description,
  priceSats,
  sellerLabel,
}: Props) {
  const { createCheckout, isLoading } = useCheckout();
  const [error, setError] = useState<string | null>(null);

  const fee = platformFeeSats(priceSats);
  const total = totalCheckoutSats(priceSats);

  const handleHire = async () => {
    setError(null);
    const result = await createCheckout({
      type: "AMOUNT",
      title: `Hire: ${title}`,
      description: `${description.slice(0, 140)}${description.length > 140 ? "…" : ""}`,
      amount: total,
      currency: "SAT",
      successUrl: "/checkout/success",
      metadata: {
        flow: "marketplace",
        listingId,
        sellerLabel,
        listingPriceSats: String(priceSats),
        platformFeeSats: String(fee),
        totalSats: String(total),
      },
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    window.location.href = result.data.checkoutUrl;
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-400">
        <p>
          <span className="text-zinc-300">{priceSats} sats</span> to seller ·{" "}
          <span className="text-amber-500/90">{fee} sats</span> platform fee ·{" "}
          <span className="text-zinc-200 font-medium">{total} sats</span> total
        </p>
        <p className="mt-1 text-xs text-zinc-600">One Lightning checkout; settlement to sellers in a follow-on payout (demo model).</p>
      </div>
      <button
        type="button"
        onClick={handleHire}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
      >
        {isLoading ? "Creating checkout…" : `Hire for ${total} sats (Lightning)`}
      </button>
    </div>
  );
}
