export type InvokeResult = {
  success: boolean;
  output: Record<string, unknown>;
  costUsd: number;
  latencyMs: number;
  rawProvider?: string;
  error?: string;
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

export async function invokeProvider(
  adapterType: string,
  providerServiceId: string | null,
  inputPayload: Record<string, unknown>,
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
          "X-Title": "AgentValue marketplace",
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

    default:
      return done({
        success: false,
        output: {
          error: `Adapter "${adapterType}" is not implemented in this MVP build.`,
          hint: "Use openrouter or tavily for live calls; others are catalogued for ranking only.",
        },
        error: "adapter_unavailable",
      });
  }
}
