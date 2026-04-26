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

    /** Built-in demo datasets / toy APIs — no external keys; safe for hackathon listings. */
    case "demo_static": {
      const preset = String(providerServiceId ?? "demo_echo").trim();
      const textIn = (k: string) =>
        String(inputPayload[k] ?? inputPayload.query ?? inputPayload.prompt ?? "").trim();

      if (preset === "demo_echo") {
        const message = textIn("message") || textIn("query") || textIn("prompt") || "(empty)";
        return done({
          success: true,
          output: {
            type: "echo",
            message,
            note: "Returns whatever you send — good smoke test for invoke + orders.",
          },
          costUsd: 0,
          rawProvider: "demo_static",
        });
      }

      if (preset === "demo_product_catalog") {
        const rows = [
          { sku: "HV-001", name: "Sensor pack", category: "hardware", priceUsd: 24.99, stock: 120 },
          { sku: "HV-002", name: "Edge node license", category: "software", priceUsd: 9.0, stock: 500 },
          { sku: "HV-003", name: "LoRa gateway", category: "hardware", priceUsd: 189.0, stock: 18 },
          { sku: "HV-004", name: "Dataset: urban noise", category: "dataset", priceUsd: 0, stock: 1 },
          { sku: "HV-005", name: "Support hour", category: "services", priceUsd: 150.0, stock: 40 },
        ];
        const cat = String(inputPayload.category ?? "").toLowerCase();
        const filtered = cat ? rows.filter((r) => r.category === cat) : rows;
        return done({
          success: true,
          output: {
            type: "dataset",
            schema: "product_row",
            rows: filtered,
            count: filtered.length,
          },
          costUsd: 0,
          rawProvider: "demo_static",
        });
      }

      if (preset === "demo_hackathon_teams") {
        return done({
          success: true,
          output: {
            type: "dataset",
            schema: "team_row",
            rows: [
              { teamId: "T1", name: "Lightning llamas", track: "payments", members: 4 },
              { teamId: "T2", name: "RAG runners", track: "agents", members: 3 },
              { teamId: "T3", name: "MCP masons", track: "tools", members: 5 },
              { teamId: "T4", name: "Eval elves", track: "safety", members: 2 },
            ],
          },
          costUsd: 0,
          rawProvider: "demo_static",
        });
      }

      if (preset === "demo_sentiment_toy") {
        const text = textIn("text") || textIn("message") || "neutral";
        const score = ((text.length % 5) + 5) % 5;
        const label = score >= 3 ? "positive" : score <= 1 ? "negative" : "neutral";
        return done({
          success: true,
          output: {
            type: "classification",
            text_sample: text.slice(0, 200),
            label,
            score,
            disclaimer: "Toy heuristic — not a real model.",
          },
          costUsd: 0,
          rawProvider: "demo_static",
        });
      }

      if (preset === "demo_world_capitals") {
        const capitals: Record<string, string> = {
          france: "Paris",
          japan: "Tokyo",
          kenya: "Nairobi",
          brazil: "Brasília",
          canada: "Ottawa",
        };
        const country = String(inputPayload.country ?? "france")
          .trim()
          .toLowerCase();
        const capital = capitals[country];
        if (!capital) {
          return done({
            success: false,
            output: {
              error: "Unknown country for demo lookup",
              known: Object.keys(capitals),
            },
            error: "validation",
          });
        }
        return done({
          success: true,
          output: { type: "lookup", country, capital },
          costUsd: 0,
          rawProvider: "demo_static",
        });
      }

      return done({
        success: false,
        output: {
          error: `Unknown demo_static preset "${preset}".`,
          presets: [
            "demo_echo",
            "demo_product_catalog",
            "demo_hackathon_teams",
            "demo_sentiment_toy",
            "demo_world_capitals",
          ],
        },
        error: "validation",
      });
    }

    default:
      return done({
        success: false,
        output: {
          error: `Adapter "${adapterType}" is not implemented in this MVP build.`,
          hint: "Use openrouter, tavily, firecrawl, or demo_static presets for invoke; others may be ranking-only.",
        },
        error: "adapter_unavailable",
      });
  }
}
