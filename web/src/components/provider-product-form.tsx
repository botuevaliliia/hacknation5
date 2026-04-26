"use client";

import { useMemo, useState } from "react";
import type { CatalogServiceOption } from "@/app/provider/actions";

type Props = {
  catalog: CatalogServiceOption[];
  action: (formData: FormData) => void | Promise<void>;
};

export function ProviderProductForm({ catalog, action }: Props) {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const selected = useMemo(
    () => catalog.find((c) => c.serviceId === selectedServiceId) ?? null,
    [catalog, selectedServiceId],
  );

  const isExternal = selected?.adapterType === "http_external";

  function onServiceChange(nextServiceId: string) {
    setSelectedServiceId(nextServiceId);
    const svc = catalog.find((c) => c.serviceId === nextServiceId);
    if (!svc) return;
    if (!title.trim()) setTitle(svc.name);
    if (!description.trim()) setDescription(svc.description);
  }

  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-zinc-500 sm:col-span-2">
        Linked catalog service
        <select
          name="linked_service_id"
          required
          value={selectedServiceId}
          onChange={(e) => onServiceChange(e.target.value)}
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">Select…</option>
          {catalog.map((c) => (
            <option key={c.serviceId} value={c.serviceId}>
              [{c.adapterType}] {c.serviceId} — {c.name}
            </option>
          ))}
        </select>
      </label>

      {selected ? (
        <div className="sm:col-span-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
          <p className="font-mono text-zinc-400">{selected.serviceId}</p>
          <p className="mt-1 text-zinc-300">{selected.description}</p>
          <p className="mt-1 text-zinc-600">{selected.modelCard}</p>
          <p className="mt-1 text-zinc-600">
            provider: {selected.provider}
            {selected.providerServiceId ? ` · contract: ${selected.providerServiceId}` : ""}
          </p>
        </div>
      ) : null}

      <label className="text-xs text-zinc-500 sm:col-span-2">
        Title
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </label>
      <label className="text-xs text-zinc-500 sm:col-span-2">
        Description
        <textarea
          name="description"
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </label>
      <label className="text-xs text-zinc-500">
        Type
        <select
          name="type"
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="agent">agent</option>
          <option value="dataset">dataset</option>
          <option value="mcp_server">mcp_server</option>
        </select>
      </label>
      <label className="text-xs text-zinc-500">
        Price (sats)
        <input
          name="price_sats"
          type="number"
          min={0}
          defaultValue={100}
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </label>
      <label className="text-xs text-zinc-500 sm:col-span-2">
        Base URL {isExternal ? "(required for this service)" : "(optional)"}
        <input
          name="base_url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://your-service.onrender.com"
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
        />
      </label>
      <label className="text-xs text-zinc-500">
        Invoke path
        <input
          name="invoke_path"
          defaultValue="/invoke"
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
        />
      </label>
      <label className="text-xs text-zinc-500 sm:col-span-2">
        Extra headers (JSON object, optional)
        <input
          name="headers_json"
          defaultValue="{}"
          className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          Publish product
        </button>
      </div>
    </form>
  );
}
