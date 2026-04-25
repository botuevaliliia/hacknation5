"use client";

import { Checkout } from "@moneydevkit/nextjs";
import { use } from "react";

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <Checkout id={id} />
    </div>
  );
}
