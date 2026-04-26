import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDatabaseConfigured } from "@/db";
import { placeOrderForUser } from "@/lib/order-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "database_required" } }, { status: 503 });
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return Response.json({ error: { message: "Supabase not configured" } }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  let body: {
    product_id?: string;
    task?: string;
    budget_usd?: number;
    input?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const productId = body.product_id?.trim();
  if (!productId) {
    return Response.json({ error: { message: "product_id required" } }, { status: 400 });
  }

  const result = await placeOrderForUser({
    buyerUserId: user.id,
    productId,
    task: (body.task ?? "Marketplace order").trim(),
    budgetUsd: Number(body.budget_usd) > 0 ? Number(body.budget_usd) : 2,
    invokeInput: body.input ?? {},
    buyerAgentLabel: `user_${user.id.slice(0, 8)}`,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    order_id: result.orderId,
    transaction_id: result.transactionId,
    cost_usd: result.costUsd,
    feedback_url: "/dashboard/orders",
  });
}
