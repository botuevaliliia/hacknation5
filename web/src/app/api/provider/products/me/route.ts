import { getDb, isDatabaseConfigured } from "@/db";
import {
  ensureProviderAccountForUser,
  publishProviderProductForOwner,
} from "@/lib/provider-publish";
import { getUserFromBearerRequest } from "@/lib/supabase/bearer-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "database_required" } }, { status: 503 });
  }

  const auth = await getUserFromBearerRequest(req);
  if (auth.error === "config") {
    return Response.json({ error: { message: "Supabase not configured" } }, { status: 500 });
  }
  if (auth.error === "missing_token") {
    return Response.json(
      {
        error: {
          code: "unauthorized",
          message:
            "Send Authorization: Bearer <supabase_access_token>. Agents obtain this after the user signs in (or via refresh token flow); no AGENT_API_KEY is required for this route.",
        },
      },
      { status: 401 },
    );
  }
  if (auth.error === "invalid_token" || !auth.user) {
    return Response.json({ error: { code: "unauthorized", message: "Invalid or expired access token" } }, {
      status: 401,
    });
  }

  let body: {
    title?: string;
    description?: string;
    type?: string;
    price_sats?: number;
    linked_service_id?: string;
    base_url?: string;
    invoke_path?: string;
    headers?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const db = getDb();
  await ensureProviderAccountForUser(db, auth.user.id, auth.user.email);

  const result = await publishProviderProductForOwner(db, auth.user.id, {
    title: String(body.title ?? ""),
    description: String(body.description ?? ""),
    type: String(body.type ?? "agent"),
    priceSats: Number(body.price_sats),
    linkedServiceIdRaw: String(body.linked_service_id ?? ""),
    baseUrl: String(body.base_url ?? ""),
    invokePathRaw: String(body.invoke_path ?? "/invoke"),
    headers:
      body.headers && typeof body.headers === "object" && !Array.isArray(body.headers)
        ? body.headers
        : undefined,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, product: result.product });
}
