import http from "node:http";

const PORT = Number(process.env.PORT || 3003);
const SERVICE = "external_agent_hackathon_teams";

const ROWS = [
  { teamId: "T1", name: "Lightning llamas", track: "payments", members: 4 },
  { teamId: "T2", name: "RAG runners", track: "agents", members: 3 },
  { teamId: "T3", name: "MCP masons", track: "tools", members: 5 },
  { teamId: "T4", name: "Eval elves", track: "safety", members: 2 },
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
      hint: "POST /invoke returns static team rows; input is ignored.",
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
    try {
      raw ? JSON.parse(raw) : {};
    } catch {
      json(res, 400, { success: false, error: "invalid_json" });
      return;
    }
    json(res, 200, {
      success: true,
      output: { type: "dataset", schema: "team_row", rows: ROWS },
      cost_usd: 0,
    });
  });
});

server.listen(PORT, () => {
  console.log(`${SERVICE} listening on http://127.0.0.1:${PORT}`);
});
