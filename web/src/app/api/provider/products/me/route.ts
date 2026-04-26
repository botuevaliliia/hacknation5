import { getDb, isDatabaseConfigured } from "@/db";
import {
  ensureProviderAccountForUser,
  listProviderProductsForOwner,
  publishProviderProductForOwner,
  updateProviderProductForOwner,
} from "@/lib/provider-publish";
import { getUserFromBearerRequest } from "@/lib/supabase/bearer-user";

export const dynamic = "force-dynamic";

async function requireUser(req: Request) {
  if (!isDatabaseConfigured()) {
    return { response: Response.json({ error: { code: "database_required" } }, { status: 503 }) };
  }

  const auth = await getUserFromBearerRequest(req);
  if (auth.error === "config") {
    return { response: Response.json({ error: { message: "Supabase not configured" } }, { status: 500 }) };
  }
  if (auth.error === "missing_token") {
    return {
      response: Response.json(
        {
          error: {
            code: "unauthorized",
            message:
              "Send Authorization: Bearer <supabase_access_token>. Agents obtain this after the user signs in (or via refresh token flow); no AGENT_API_KEY is required for this route.",
          },
        },
        { status: 401 },
      ),
    };
  }
  if (auth.error === "invalid_token" || !auth.user) {
    return {
      response: Response.json(
        { error: { code: "unauthorized", message: "Invalid or expired access token" } },
        {
          status: 401,
        },
      ),
    };
  }
  return { user: auth.user };
}

export async function POST(req: Request) {
  const guard = await requireUser(req);
  if ("response" in guard) return guard.response;

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
  await ensureProviderAccountForUser(db, guard.user.id, guard.user.email);

  const result = await publishProviderProductForOwner(db, guard.user.id, {
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

export async function GET(req: Request) {
  const guard = await requireUser(req);
  if ("response" in guard) return guard.response;
  const db = getDb();
  await ensureProviderAccountForUser(db, guard.user.id, guard.user.email);
  const products = await listProviderProductsForOwner(db, guard.user.id);
  return Response.json({ ok: true, products });
}

export async function PATCH(req: Request) {
  const guard = await requireUser(req);
  if ("response" in guard) return guard.response;

  let body: {
    product_id?: string;
    title?: string;
    description?: string;
    type?: string;
    price_sats?: number;
    linked_service_id?: string;
    base_url?: string;
    invoke_path?: string;
    headers?: Record<string, string>;
    active?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const db = getDb();
  await ensureProviderAccountForUser(db, guard.user.id, guard.user.email);
  const result = await updateProviderProductForOwner(db, guard.user.id, {
    productId: String(body.product_id ?? ""),
    title: typeof body.title === "string" ? body.title : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    type: typeof body.type === "string" ? body.type : undefined,
    priceSats: Number(body.price_sats),
    linkedServiceIdRaw: typeof body.linked_service_id === "string" ? body.linked_service_id : undefined,
    baseUrl: typeof body.base_url === "string" ? body.base_url : undefined,
    invokePathRaw: typeof body.invoke_path === "string" ? body.invoke_path : undefined,
    headers:
      body.headers && typeof body.headers === "object" && !Array.isArray(body.headers)
        ? body.headers
        : undefined,
    active:
      body.active === 0 || body.active === 1
        ? body.active
        : undefined,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, product: result.product });
}
