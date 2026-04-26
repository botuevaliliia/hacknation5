"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export function FeedbackForm({ transactionId }: { transactionId: string }) {
  const [q, setQ] = useState("0.9");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/marketplace/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transaction_id: transactionId,
          quality_score: Number(q),
          task_success: true,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setMsg(String((json.error as { message?: string })?.message ?? JSON.stringify(json)));
        return;
      }
      setMsg("Feedback saved. Order closed.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-zinc-500">
        Quality 0–1
        <input
          type="number"
          step="0.01"
          min={0}
          max={1}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="ml-2 w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Submit feedback"}
      </button>
      {msg ? <span className="text-xs text-zinc-500">{msg}</span> : null}
    </form>
  );
}
