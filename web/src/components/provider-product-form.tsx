"use client";

import { useMemo, useState } from "react";
import type { CatalogServiceOption } from "@/app/provider/actions";

export type ProviderProductFormInitial = {
  linkedServiceId: string;
  title: string;
  description: string;
  type: string;
  priceSats: number;
  baseUrl: string;
  invokePath: string;
  headersJson: string;
};

type Props = {
  catalog: CatalogServiceOption[];
  action: (formData: FormData) => void | Promise<void>;
  mode?: "create" | "edit";
  productId?: string;
  initial?: ProviderProductFormInitial;
};

export function ProviderProductForm({ catalog, action, mode = "create", productId, initial }: Props) {
  const [selectedServiceId, setSelectedServiceId] = useState(initial?.linkedServiceId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");

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

  const isEdit = mode === "edit";

  return (
    <form
      key={isEdit ? productId : "create"}
      action={action}
      className="mt-4 grid gap-4 sm:grid-cols-2"
    >
      {isEdit && productId ? <input type="hidden" name="product_id" value={productId} /> : null}
      <label className="text-sm text-zinc-300 sm:col-span-2">
        Service ID (your contract key)
        <input
          name="linked_service_id"
          required
          value={selectedServiceId}
          onChange={(e) => onServiceChange(e.target.value)}
          list="service-contract-suggestions"
          placeholder="e.g. myagent_semantic_search_v1"
          className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
        />
        <datalist id="service-contract-suggestions">
          {catalog.map((c) => (
            <option key={c.serviceId} value={c.serviceId} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-zinc-500">
          Existing IDs auto-fill details; new IDs create a new contract owned by your account.
        </p>
      </label>

      {selected ? (
        <div className="sm:col-span-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs">
          <p className="font-mono text-amber-300">{selected.serviceId}</p>
          <p className="mt-1 text-zinc-200">{selected.description}</p>
          <p className="mt-1 text-zinc-400">{selected.modelCard}</p>
          <p className="mt-1 text-zinc-400">
            provider: {selected.provider}
            {selected.providerServiceId ? ` · contract: ${selected.providerServiceId}` : ""}
          </p>
        </div>
      ) : null}

      <label className="text-sm text-zinc-300 sm:col-span-2">
        Title
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="text-sm text-zinc-300 sm:col-span-2">
        Description
        <textarea
          name="description"
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="text-sm text-zinc-300">
        Type
        <select
          name="type"
          defaultValue={initial?.type ?? "agent"}
          className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
        >
          <option value="agent">agent</option>
          <option value="dataset">dataset</option>
          <option value="mcp_server">mcp_server</option>
        </select>
      </label>
      <label className="text-sm text-zinc-300">
        Price (sats)
        <input
          name="price_sats"
          type="number"
          min={0}
          defaultValue={initial?.priceSats ?? 100}
          className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="text-sm text-zinc-300 sm:col-span-2">
        Base URL {isExternal ? "(required for this service)" : "(optional)"}
        <input
          name="base_url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://your-service.onrender.com"
          className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
        />
      </label>
      <label className="text-sm text-zinc-300">
        Invoke path
        <input
          name="invoke_path"
          defaultValue={initial?.invokePath ?? "/invoke"}
          className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
        />
      </label>
      <label className="text-sm text-zinc-300 sm:col-span-2">
        Extra headers (JSON object, optional)
        <input
          name="headers_json"
          defaultValue={initial?.headersJson ?? "{}"}
          className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          {isEdit ? "Save changes" : "Publish product"}
        </button>
      </div>
    </form>
  );
}
