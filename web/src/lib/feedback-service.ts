import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { updateReputationFromFeedback } from "@/marketplace/reputation";

const { agentTransactions } = schema;

export type FeedbackInput = {
  transactionId: string;
  taskSuccess?: boolean;
  qualityScore: number;
  resultUseful?: boolean;
  priceFair?: boolean;
  latencyOk?: boolean;
  wouldUseAgain?: boolean;
  freeformNote?: string | null;
};

export type FeedbackResult =
  | {
      ok: true;
      transactionId: string;
      resultingReputationSnapshotId: string;
      updatedTrustScore: number;
      serviceId: string;
      previousReputationSnapshotId: string;
      previousTrustScore: number;
    }
  | { ok: false; status: number; error: Record<string, unknown> };

export async function applyAgentFeedback(body: FeedbackInput): Promise<FeedbackResult> {
  const id = body.transactionId.trim();
  const q = body.qualityScore;
  if (!id) {
    return { ok: false, status: 400, error: { message: "transaction_id required" } };
  }
  if (typeof q !== "number" || q < 0 || q > 1) {
    return { ok: false, status: 400, error: { message: "quality_score must be between 0 and 1" } };
  }
  const taskSuccess = body.taskSuccess !== false;

  const db = getDb();
  const [tx] = await db.select().from(agentTransactions).where(eq(agentTransactions.id, id));
  if (!tx) {
    return { ok: false, status: 404, error: { message: "Transaction not found" } };
  }
  if (tx.status === "closed") {
    return { ok: false, status: 400, error: { message: "Transaction already closed" } };
  }
  if (tx.status !== "feedback_required") {
    return { ok: false, status: 400, error: { message: "Invalid transaction state" } };
  }

  const rep = await updateReputationFromFeedback(tx.serviceId, {
    task_success: taskSuccess,
    quality_score: q,
  });

  const feedback = {
    task_success: taskSuccess,
    quality_score: q,
    result_useful: body.resultUseful ?? true,
    price_fair: body.priceFair ?? true,
    latency_ok: body.latencyOk ?? true,
    would_use_again: body.wouldUseAgain ?? true,
    freeform_note: body.freeformNote ?? null,
  };

  await db
    .update(agentTransactions)
    .set({
      status: "closed",
      feedbackJson: feedback,
      closedAt: new Date(),
    })
    .where(eq(agentTransactions.id, id));

  return {
    ok: true,
    transactionId: id,
    resultingReputationSnapshotId: rep.snapshotId,
    updatedTrustScore: rep.newTrust,
    serviceId: tx.serviceId,
    previousReputationSnapshotId: rep.previousSnapshotId,
    previousTrustScore: rep.previousTrust,
  };
}
