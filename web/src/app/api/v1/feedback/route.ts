import { eq } from "drizzle-orm";
import { requireAgentOr401 } from "@/lib/agent-auth";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { updateReputationFromFeedback } from "@/marketplace/reputation";

export const dynamic = "force-dynamic";

const { agentTransactions } = schema;

export async function POST(req: Request) {
  const denied = requireAgentOr401(req);
  if (denied) {
    return denied;
  }
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "database_required" } }, { status: 503 });
  }

  let body: {
    transaction_id?: string;
    task_success?: boolean;
    quality_score?: number;
    result_useful?: boolean;
    price_fair?: boolean;
    latency_ok?: boolean;
    would_use_again?: boolean;
    freeform_note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const id = body.transaction_id?.trim();
  if (!id) {
    return Response.json({ error: { message: "transaction_id required" } }, { status: 400 });
  }
  const q = body.quality_score;
  if (typeof q !== "number" || q < 0 || q > 1) {
    return Response.json(
      { error: { message: "quality_score must be between 0 and 1" } },
      { status: 400 },
    );
  }
  const taskSuccess = body.task_success !== false;

  const db = getDb();
  const [tx] = await db.select().from(agentTransactions).where(eq(agentTransactions.id, id));
  if (!tx) {
    return Response.json({ error: { message: "Transaction not found" } }, { status: 404 });
  }
  if (tx.status === "closed") {
    return Response.json({ error: { message: "Transaction already closed" } }, { status: 400 });
  }
  if (tx.status !== "feedback_required") {
    return Response.json({ error: { message: "Invalid transaction state" } }, { status: 400 });
  }

  const rep = await updateReputationFromFeedback(tx.serviceId, {
    task_success: taskSuccess,
    quality_score: q,
  });

  const feedback = {
    task_success: taskSuccess,
    quality_score: q,
    result_useful: body.result_useful ?? true,
    price_fair: body.price_fair ?? true,
    latency_ok: body.latency_ok ?? true,
    would_use_again: body.would_use_again ?? true,
    freeform_note: body.freeform_note ?? null,
  };

  await db
    .update(agentTransactions)
    .set({
      status: "closed",
      feedbackJson: feedback,
      closedAt: new Date(),
    })
    .where(eq(agentTransactions.id, id));

  return Response.json({
    transaction_id: id,
    status: "closed",
    feedback_accepted: true,
    resulting_reputation_snapshot_id: rep.snapshotId,
    updated_trust_score: rep.newTrust,
    ranking_impact: {
      service_id: tx.serviceId,
      previous_reputation_snapshot_id: rep.previousSnapshotId,
      previous_trust_score: rep.previousTrust,
      new_reputation_snapshot_id: rep.snapshotId,
      new_trust_score: rep.newTrust,
    },
  });
}
