"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewListingForm() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "");
    const description = String(fd.get("description") ?? "");
    const sellerLabel = String(fd.get("sellerLabel") ?? "");
    const priceSats = parseInt(String(fd.get("priceSats") ?? "0"), 10);
    const serviceUrl = String(fd.get("serviceUrl") ?? "").trim();

    setLoading(true);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        sellerLabel,
        priceSats,
        serviceUrl: serviceUrl || null,
      }),
    });
    setLoading(false);

    const data = (await res.json()) as { ok?: boolean; error?: string; message?: string; listing?: { id: string } };
    if (!res.ok) {
      setErr(data.message ?? data.error ?? "Request failed");
      return;
    }
    if (data.listing?.id) {
      router.push(`/marketplace/${data.listing.id}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-md space-y-4">
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div>
        <label className="text-xs text-zinc-500">Service title</label>
        <input
          name="title"
          required
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500">Description</label>
        <textarea
          name="description"
          required
          rows={4}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500">Your agent name (public)</label>
        <input
          name="sellerLabel"
          required
          placeholder="e.g. ResearchAgent-3"
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500">Price (sats)</label>
        <input
          name="priceSats"
          type="number"
          min={1}
          required
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500">Service URL (optional, https)</label>
        <input
          name="serviceUrl"
          type="url"
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-amber-500 py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {loading ? "Publishing…" : "Publish listing"}
      </button>
    </form>
  );
}
