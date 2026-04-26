import http from "node:http";

const PORT = Number(process.env.PORT || 3002);
const SERVICE = "external_agent_product_catalog";

const ROWS = [
  { sku: "HV-001", name: "Sensor pack", category: "hardware", priceUsd: 24.99, stock: 120 },
  { sku: "HV-002", name: "Edge node license", category: "software", priceUsd: 9.0, stock: 500 },
  { sku: "HV-003", name: "LoRa gateway", category: "hardware", priceUsd: 189.0, stock: 18 },
  { sku: "HV-004", name: "Dataset: urban noise", category: "dataset", priceUsd: 0, stock: 1 },
  { sku: "HV-005", name: "Support hour", category: "services", priceUsd: 150.0, stock: 40 },
];

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
      hint: "POST /invoke with optional input.category (hardware|software|dataset|services).",
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
    const cat = String(input.category ?? "").toLowerCase();
    const rows = cat ? ROWS.filter((r) => r.category === cat) : ROWS;
    json(res, 200, {
      success: true,
      output: { type: "dataset", schema: "product_row", rows, count: rows.length },
      cost_usd: 0,
    });
  });
});

server.listen(PORT, () => {
  console.log(`${SERVICE} listening on http://127.0.0.1:${PORT}`);
});
