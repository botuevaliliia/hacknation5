"use client";

import { useState } from "react";

type Props = {
  productId: string;
  defaultInput: Record<string, unknown>;
};

export function BuyProductButton({ productId, defaultInput }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onBuy() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          task: "Marketplace purchase",
          budget_usd: 2,
          input: defaultInput,
        }),
      });
      let json: Record<string, unknown> = {};
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        setMsg(
          res.status === 502
            ? "Server error (502). If the listing used a demo catalog ID, edit it in My services: use http_external + your agent base URL."
            : `Request failed (HTTP ${res.status}).`,
        );
        return;
      }
      if (!res.ok) {
        const errObj = json.error;
        const hint =
          typeof errObj === "object" && errObj !== null && "hint" in errObj
            ? String((errObj as { hint?: unknown }).hint ?? "")
            : "";
        const message =
          typeof errObj === "object" && errObj !== null && "message" in errObj
            ? String((errObj as { message?: unknown }).message ?? "")
            : typeof json.message === "string"
              ? json.message
              : JSON.stringify(json);
        setMsg(hint ? `${message} — ${hint}` : message || `HTTP ${res.status}`);
        return;
      }
      setMsg(`Ordered. transaction_id=${String(json.transaction_id)} — submit feedback from Orders.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={onBuy}
        disabled={loading}
        className="rounded-full bg-amber-500/90 px-4 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? "Ordering…" : "Buy & invoke"}
      </button>
      {msg ? <p className="text-xs text-zinc-500">{msg}</p> : null}
    </div>
  );
}
