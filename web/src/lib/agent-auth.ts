/**
 * Agent-only mutating routes (discover/invoke/feedback per architecture).
 * Set AGENT_API_KEY in the environment; clients pass Authorization: Bearer <key> or x-api-key.
 */
export function getAgentKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  return req.headers.get("x-api-key");
}

export function isAgentAuthorized(req: Request): boolean {
  const need = process.env.AGENT_API_KEY;
  if (!need) {
    return false;
  }
  const got = getAgentKey(req);
  return got === need;
}

export function requireAgentOr401(req: Request): Response | null {
  if (!process.env.AGENT_API_KEY) {
    return Response.json(
      { error: { code: "config", message: "AGENT_API_KEY is not set on the server" } },
      { status: 500 },
    );
  }
  if (!isAgentAuthorized(req)) {
    return Response.json(
      { error: { code: "unauthorized", message: "Invalid or missing agent API key" } },
      { status: 401 },
    );
  }
  return null;
}
