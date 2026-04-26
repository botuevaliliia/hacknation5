import http from "node:http";

const PORT = Number(process.env.PORT || 3004);
const SERVICE = "external_agent_sentiment";

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (req.method === "GET" && path === "/health") {
    json(res, 200, { ok: true, service: SERVICE });
    return;
  }
  if (req.method === "GET" && path === "/") {
    json(res, 200, {
      ok: true,
      service: SERVICE,
      endpoints: { health: "GET /health", invoke: "POST /invoke" },
      hint: "POST /invoke with input.text or input.message (toy sentiment demo).",
    });
    return;
  }
  if (req.method !== "POST" || path !== "/invoke") {
    json(res, 404, {
      success: false,
      error: "not_found",
      path,
      hint: "Use POST /invoke. GET / for this help.",
    });
    return;
  }
  let raw = "";
  req.on("data", (c) => {
    raw += c;
  });
  req.on("end", () => {
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      json(res, 400, { success: false, error: "invalid_json" });
      return;
    }
    const input = typeof body.input === "object" && body.input ? body.input : {};
    const text = String(input.text ?? input.message ?? body.task ?? "neutral");
    const score = ((text.length % 5) + 5) % 5;
    const label = score >= 3 ? "positive" : score <= 1 ? "negative" : "neutral";
    json(res, 200, {
      success: true,
      output: {
        type: "classification",
        text_sample: text.slice(0, 400),
        label,
        score,
        disclaimer: "Toy heuristic for demos only.",
      },
      cost_usd: 0,
    });
  });
});

server.listen(PORT, () => {
  console.log(`${SERVICE} listening on http://127.0.0.1:${PORT}`);
});
