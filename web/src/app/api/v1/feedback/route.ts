import { requireAgentOr401 } from "@/lib/agent-auth";
import { isDatabaseConfigured } from "@/db";
import { applyAgentFeedback } from "@/lib/feedback-service";

export const dynamic = "force-dynamic";

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

  const q = body.quality_score;
  if (typeof q !== "number") {
    return Response.json(
      { error: { message: "quality_score must be between 0 and 1" } },
      { status: 400 },
    );
  }

  const res = await applyAgentFeedback({
    transactionId: body.transaction_id ?? "",
    taskSuccess: body.task_success,
    qualityScore: q,
    resultUseful: body.result_useful,
    priceFair: body.price_fair,
    latencyOk: body.latency_ok,
    wouldUseAgain: body.would_use_again,
    freeformNote: body.freeform_note ?? null,
  });

  if (!res.ok) {
    return Response.json({ error: res.error }, { status: res.status });
  }

  return Response.json({
    transaction_id: res.transactionId,
    status: "closed",
    feedback_accepted: true,
    resulting_reputation_snapshot_id: res.resultingReputationSnapshotId,
    updated_trust_score: res.updatedTrustScore,
    ranking_impact: {
      service_id: res.serviceId,
      previous_reputation_snapshot_id: res.previousReputationSnapshotId,
      previous_trust_score: res.previousTrustScore,
      new_reputation_snapshot_id: res.resultingReputationSnapshotId,
      new_trust_score: res.updatedTrustScore,
    },
  });
}
