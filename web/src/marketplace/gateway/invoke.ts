export type InvokeResult = {
  success: boolean;
  output: Record<string, unknown>;
  costUsd: number;
  latencyMs: number;
  rawProvider?: string;
  error?: string;
};

/** Optional HTTP agent deployed by the seller (see repo /demo-agent-apis). */
export type ExternalInvokeConfig = {
  baseUrl: string;
  path?: string;
  headers?: Record<string, string>;
};

export type InvokeProviderContext = {
  task?: string;
  external?: ExternalInvokeConfig | null;
};

function needKey(name: string): InvokeResult {
  return {
    success: false,
    output: { error: `${name} is not configured` },
    costUsd: 0,
    latencyMs: 0,
    error: name,
  };
}

function isAllowedExternalAgentOrigin(rawBase: string): { origin: string } | { error: string } {
  let u: URL;
  try {
    u = new URL(rawBase.trim());
  } catch {
    return { error: "invalid_base_url" };
  }
  const host = u.hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  const allowHttpRemote = process.env.ALLOW_HTTP_EXTERNAL_AGENTS === "true";
  if (u.protocol === "https:") {
    return { origin: u.origin };
  }
  if (u.protocol === "http:" && local) {
    return { origin: u.origin };
  }
  if (u.protocol === "http:" && allowHttpRemote) {
    return { origin: u.origin };
  }
  return { error: "only_https_or_localhost_http_unless_ALLOW_HTTP_EXTERNAL_AGENTS" };
}

export async function invokeProvider(
  adapterType: string,
  providerServiceId: string | null,
  inputPayload: Record<string, unknown>,
  ctx?: InvokeProviderContext | null,
): Promise<InvokeResult> {
  const t0 = Date.now();
  const done = (r: Partial<InvokeResult>): InvokeResult => ({
    success: r.success ?? false,
    output: r.output ?? {},
    costUsd: r.costUsd ?? 0,
    latencyMs: Date.now() - t0,
    rawProvider: r.rawProvider,
    error: r.error,
  });

  switch (adapterType) {
    case "openrouter": {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return done(needKey("OPENROUTER_API_KEY"));
      const model = providerServiceId ?? "qwen/qwen3-coder:free";
      const messages =
        Array.isArray(inputPayload.messages) && inputPayload.messages.length > 0
          ? inputPayload.messages
          : [
              {
                role: "user",
                content: String(inputPayload.prompt ?? inputPayload.task ?? "Hello"),
              },
            ];
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ?? "https://localhost",
          "X-Title": "Pactly marketplace",
        },
        body: JSON.stringify({ model, messages, max_tokens: 800 }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        return done({
          success: false,
          output: { error: json },
          error: "openrouter_http",
        });
      }
      const choice = (json.choices as { message?: { content?: string } }[] | undefined)?.[0];
      const text = choice?.message?.content ?? "";
      return done({
        success: true,
        output: { type: "text", text, raw: json },
        costUsd: 0,
        rawProvider: "openrouter",
      });
    }

    case "tavily": {
      const key = process.env.TAVILY_API_KEY;
      if (!key) return done(needKey("TAVILY_API_KEY"));
      const query = String(inputPayload.query ?? inputPayload.q ?? "");
      if (!query) {
        return done({ success: false, output: { error: "Missing query" }, error: "validation" });
      }
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: "basic",
          max_results: 5,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        return done({ success: false, output: { error: json }, error: "tavily_http" });
      }
      return done({
        success: true,
        output: { type: "search", result: json },
        costUsd: 0.02,
        rawProvider: "tavily",
      });
    }

    case "exa": {
      const key = process.env.EXA_API_KEY;
      if (!key) return done(needKey("EXA_API_KEY"));
      const query = String(inputPayload.query ?? "");
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
        },
        body: JSON.stringify({ query, numResults: 5, useAutoprompt: true }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        return done({ success: false, output: { error: json }, error: "exa_http" });
      }
      return done({
        success: true,
        output: { type: "search", result: json },
        costUsd: 0.03,
        rawProvider: "exa",
      });
    }

    case "serper": {
      const key = process.env.SERPER_API_KEY;
      if (!key) return done(needKey("SERPER_API_KEY"));
      const q = String(inputPayload.q ?? inputPayload.query ?? "");
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": key,
        },
        body: JSON.stringify({ q }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        return done({ success: false, output: { error: json }, error: "serper_http" });
      }
      return done({
        success: true,
        output: { type: "serp", result: json },
        costUsd: 0.01,
        rawProvider: "serper",
      });
    }

    case "firecrawl": {
      const key = process.env.FIRECRAWL_API_KEY;
      if (!key) return done(needKey("FIRECRAWL_API_KEY"));
      const url = String(inputPayload.url ?? "");
      if (!url) {
        return done({ success: false, output: { error: "Missing url" }, error: "validation" });
      }
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        return done({ success: false, output: { error: json }, error: "firecrawl_http" });
      }
      return done({
        success: true,
        output: { type: "markdown", result: json },
        costUsd: 0.02,
        rawProvider: "firecrawl",
      });
    }

    case "http_external": {
      const ext = ctx?.external;
      const baseRaw = ext?.baseUrl?.trim();
      if (!baseRaw) {
        return done({
          success: false,
          output: {
            error: "external_http_missing_base_url",
            message:
              "Deploy an HTTP agent (see repo demo-agent-apis/), then set product base URL in Provider → Products.",
          },
          error: "configuration",
        });
      }
      const allowed = isAllowedExternalAgentOrigin(baseRaw);
      if ("error" in allowed) {
        return done({
          success: false,
          output: { error: allowed.error, base_url: baseRaw },
          error: "validation",
        });
      }
      const pathRaw = (ext?.path?.trim() || "/invoke").startsWith("/")
        ? ext?.path?.trim() || "/invoke"
        : `/${ext?.path?.trim() || "invoke"}`;
      const target = new URL(pathRaw, `${allowed.origin}/`).toString();
      const taskStr = String(ctx?.task ?? inputPayload.task ?? "").slice(0, 8000);
      const headers: Record<string, string> = {
        "content-type": "application/json",
        ...(ext?.headers && typeof ext.headers === "object" ? ext.headers : {}),
      };
      let res: Response;
      try {
        res = await fetch(target, {
          method: "POST",
          headers,
          body: JSON.stringify({
            task: taskStr,
            input: inputPayload,
            service_contract: providerServiceId,
          }),
          signal: AbortSignal.timeout(25_000),
        });
      } catch (e) {
        return done({
          success: false,
          output: { error: "fetch_failed", detail: e instanceof Error ? e.message : String(e) },
          error: "http_external",
        });
      }
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        json = { raw: text.slice(0, 4000) };
      }
      if (!res.ok) {
        return done({
          success: false,
          output: { http_status: res.status, body: json },
          error: "http_external",
        });
      }
      const success = Boolean(json.success);
      const output =
        typeof json.output === "object" && json.output !== null && !Array.isArray(json.output)
          ? (json.output as Record<string, unknown>)
          : ({ body: json } as Record<string, unknown>);
      const costUsd = Number(json.cost_usd ?? json.costUsd ?? 0) || 0;
      return done({
        success,
        output: success ? output : { ...output, agent_error: json.error },
        costUsd,
        rawProvider: "http_external",
        error: success ? undefined : String(json.error ?? "agent_reported_failure"),
      });
    }

    default:
      return done({
        success: false,
        output: {
          error: `Adapter "${adapterType}" is not implemented in this MVP build.`,
          hint: "Use openrouter, tavily, firecrawl, or http_external (deployed agent URL) for invoke.",
        },
        error: "adapter_unavailable",
      });
  }
}
