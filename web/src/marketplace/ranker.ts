import { createHash, randomBytes } from "node:crypto";

export type ServiceRow = {
  serviceId: string;
  name: string;
  description: string;
  modelCard: string;
  estimatedBaseCostUsd: number;
  trustScore: number; // 0–1
  capabilities: string[];
  adapterType: string;
};

export type RankedService = {
  serviceId: string;
  name: string;
  rank: number;
  score: number;
  taskRelevance: number;
  trustScore: number;
  costValue: number;
  reputationSnapshotId: string;
  estimatedCostUsd: number;
  reasons: string[];
  adapterType: string;
  description: string;
  modelCard: string;
};

const W_TASK = 0.5;
const W_TRUST = 0.3;
const W_COST = 0.2;

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

/** Semantic-ish relevance without embeddings: Jaccard on task vs description+card. */
export function taskRelevanceScore(task: string, svc: ServiceRow): number {
  const t = tokenize(task);
  const c = tokenize(svc.description + " " + svc.modelCard);
  if (t.size === 0) return 0.5;
  let inter = 0;
  for (const w of t) {
    if (c.has(w)) inter++;
  }
  const union = t.size + c.size - inter;
  const j = union > 0 ? inter / union : 0;
  return Math.min(1, 0.25 + j * 1.5);
}

function costValue(estimated: number, budget: number): number {
  if (budget <= 0) return 0.5;
  if (estimated > budget) return 0;
  return Math.min(1, 1 - estimated / (budget * 1.1));
}

function snapshotId(serviceId: string, trust: number): string {
  const h = createHash("sha256")
    .update(`${serviceId}:${trust.toFixed(4)}:v1`)
    .digest("hex")
    .slice(0, 24);
  return `rep_snap_${h}`;
}

export function rankServices(
  task: string,
  budgetUsd: number,
  candidates: ServiceRow[],
  mode: "weighted" | "synthetic_ltr",
): { rankingEventId: string; modelId: string; results: RankedService[] } {
  const rankingEventId = `rank_${randomBytes(8).toString("hex")}`;
  const modelId = mode === "synthetic_ltr" ? "synthetic_ltr_v1" : "weighted_baseline_v1";

  const prepared = candidates
    .map((s) => {
      const tr = taskRelevanceScore(task, s);
      const trust = Math.min(1, Math.max(0, s.trustScore));
      const cv = costValue(s.estimatedBaseCostUsd, budgetUsd);
      let score: number;
      if (mode === "synthetic_ltr") {
        // Slight nudge so demo differs from pure weighted: still linear on same features, different mix (per arch “synthetic LTR v1”)
        score = 0.45 * tr + 0.35 * trust + 0.2 * cv;
      } else {
        score = W_TASK * tr + W_TRUST * trust + W_COST * cv;
      }
      const repId = snapshotId(s.serviceId, trust);
      const reasons: string[] = [];
      if (tr >= 0.4) reasons.push("high task relevance");
      if (trust >= 0.65) reasons.push("strong trust score");
      if (cv >= 0.5) reasons.push("within budget");
      if (reasons.length === 0) reasons.push("eligible candidate");
      return {
        serviceId: s.serviceId,
        name: s.name,
        rank: 0,
        score,
        taskRelevance: tr,
        trustScore: trust,
        costValue: cv,
        reputationSnapshotId: repId,
        estimatedCostUsd: s.estimatedBaseCostUsd,
        reasons,
        adapterType: s.adapterType,
        description: s.description,
        modelCard: s.modelCard,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return { rankingEventId, modelId, results: prepared };
}
