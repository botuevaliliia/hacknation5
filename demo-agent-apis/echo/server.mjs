import http from "node:http";

const PORT = Number(process.env.PORT || 3001);
const SERVICE = "external_agent_echo";

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
    const msg = String(
      input.message ?? input.query ?? input.prompt ?? body.task ?? "",
    ).trim();
    json(res, 200, {
      success: true,
      output: { type: "echo", message: msg || "(empty)", task: String(body.task ?? "") },
      cost_usd: 0,
    });
  });
});

server.listen(PORT, () => {
  console.log(`${SERVICE} listening on http://127.0.0.1:${PORT}`);
});
