import { requireAgentOr401 } from "@/lib/agent-auth";
import { filterByCapability, loadServicesForRanking } from "@/marketplace/catalog/loader";
import { rankServices } from "@/marketplace/ranker";
import { getDb, isDatabaseConfigured, schema } from "@/db";

export const dynamic = "force-dynamic";

const { agentRankingLog } = schema;

export async function POST(req: Request) {
  const denied = requireAgentOr401(req);
  if (denied) {
    return denied;
  }
  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: { code: "database_required", message: "Set DATABASE_URL (Neon)" } },
      { status: 503 },
    );
  }

  let body: {
    task?: string;
    budget_usd?: number;
    required_capability?: string;
    ranker_mode?: "weighted" | "synthetic_ltr";
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const task = (body.task ?? "").trim();
  const budget = Number(body.budget_usd);
  if (task.length < 3) {
    return Response.json({ error: { message: "task required" } }, { status: 400 });
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return Response.json({ error: { message: "budget_usd must be > 0" } }, { status: 400 });
  }
  const mode = body.ranker_mode === "weighted" ? "weighted" : "synthetic_ltr";
  const cap = body.required_capability?.trim() || null;

  let candidates = await loadServicesForRanking();
  candidates = filterByCapability(candidates, cap);
  candidates = candidates.filter((c) => c.estimatedBaseCostUsd <= budget);

  if (candidates.length === 0) {
    return Response.json({
      ranking_event_id: null,
      query: task,
      budget_usd: budget,
      ranker_mode: mode,
      results: [],
      message: "No eligible services for this task/budget/capability filter.",
    });
  }

  const { rankingEventId, modelId, results } = rankServices(task, budget, candidates, mode);
  const apiResults = results.map((r) => ({
    ...r,
    service_id: r.serviceId,
  }));

  const db = getDb();
  await db.insert(agentRankingLog).values({
    rankingEventId,
    task,
    budgetUsd: budget,
    rankerMode: mode,
    modelId,
    resultsJson: apiResults,
  });

  return Response.json({
    ranking_event_id: rankingEventId,
    query: task,
    budget_usd: budget,
    ranker_mode: mode,
    ranking_model_id: modelId,
    results: apiResults,
  });
}
