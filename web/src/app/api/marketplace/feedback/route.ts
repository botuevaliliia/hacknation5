import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { applyAgentFeedback } from "@/lib/feedback-service";
import { getOrderByTransactionId } from "@/lib/order-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const { marketplaceOrders, usageEvents } = schema;

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
    transaction_id?: string;
    quality_score?: number;
    task_success?: boolean;
    freeform_note?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const txId = body.transaction_id?.trim();
  if (!txId) {
    return Response.json({ error: { message: "transaction_id required" } }, { status: 400 });
  }

  const order = await getOrderByTransactionId(txId);
  if (!order || order.buyerUserId !== user.id) {
    return Response.json({ error: { message: "Forbidden" } }, { status: 403 });
  }

  const q = body.quality_score;
  if (typeof q !== "number" || q < 0 || q > 1) {
    return Response.json({ error: { message: "quality_score 0..1 required" } }, { status: 400 });
  }

  const res = await applyAgentFeedback({
    transactionId: txId,
    taskSuccess: body.task_success,
    qualityScore: q,
    freeformNote: body.freeform_note ?? null,
  });

  if (!res.ok) {
    return Response.json({ error: res.error }, { status: res.status });
  }

  const db = getDb();
  await db
    .update(marketplaceOrders)
    .set({
      deliveryStatus: "closed",
      updatedAt: new Date(),
    })
    .where(eq(marketplaceOrders.id, order.id));

  await db.insert(usageEvents).values({
    providerProductId: order.providerProductId,
    buyerUserId: user.id,
    agentTransactionId: txId,
    eventType: "feedback",
    meta: { orderId: order.id, quality: q },
  });

  return Response.json({
    ok: true,
    transaction_id: txId,
    order_id: order.id,
    reputation: {
      snapshot_id: res.resultingReputationSnapshotId,
      trust: res.updatedTrustScore,
    },
  });
}
