import http from "node:http";

const PORT = Number(process.env.PORT || 3005);
const SERVICE = "external_agent_capitals";

const CAPITALS = {
  france: "Paris",
  japan: "Tokyo",
  kenya: "Nairobi",
  brazil: "Brasília",
  canada: "Ottawa",
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url.split("?")[0] === "/health") {
    json(res, 200, { ok: true, service: SERVICE });
    return;
  }
  if (req.method !== "POST" || req.url.split("?")[0] !== "/invoke") {
    json(res, 404, { success: false, error: "not_found" });
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
    const country = String(input.country ?? "france")
      .trim()
      .toLowerCase();
    const capital = CAPITALS[country];
    if (!capital) {
      json(res, 200, {
        success: false,
        error: "unknown_country",
        output: { known: Object.keys(CAPITALS) },
        cost_usd: 0,
      });
      return;
    }
    json(res, 200, {
      success: true,
      output: { type: "lookup", country, capital },
      cost_usd: 0,
    });
  });
});

server.listen(PORT, () => {
  console.log(`${SERVICE} listening on http://127.0.0.1:${PORT}`);
});
