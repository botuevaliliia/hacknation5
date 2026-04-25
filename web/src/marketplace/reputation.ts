import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

const { agentReputation, agentServices } = schema;

export function nextSnapshotId(serviceId: string, version: number): string {
  return `rep_snap_${createHash("sha256").update(`${serviceId}:v${version}:${randomBytes(4).toString("hex")}`).digest("hex").slice(0, 20)}`;
}

/**
 * Blends old trust with new feedback. quality_score 0..1
 */
export function blendTrust(oldTrust: number, quality: number, taskSuccess: boolean): number {
  const base = 0.85 * oldTrust + 0.15 * (taskSuccess ? quality : quality * 0.5);
  return Math.max(0, Math.min(1, base));
}

export async function getTrustForService(
  serviceId: string,
  seed: number,
): Promise<{ trustScore: number; snapshotId: string; version: number }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(agentReputation)
    .where(eq(agentReputation.serviceId, serviceId));
  if (row) {
    return {
      trustScore: row.trustScore,
      snapshotId: row.snapshotId,
      version: row.version,
    };
  }
  return {
    trustScore: seed,
    snapshotId: nextSnapshotId(serviceId, 0),
    version: 0,
  };
}

export async function updateReputationFromFeedback(
  serviceId: string,
  input: { task_success: boolean; quality_score: number },
): Promise<{ newTrust: number; snapshotId: string; previousSnapshotId: string; previousTrust: number }> {
  const db = getDb();
  const [svc] = await db
    .select()
    .from(agentServices)
    .where(eq(agentServices.serviceId, serviceId));
  if (!svc) {
    throw new Error("Unknown service");
  }
  const prev = await getTrustForService(serviceId, svc.trustScoreSeed);
  const newTrust = blendTrust(
    prev.trustScore,
    input.quality_score,
    input.task_success,
  );
  const version = prev.version + 1;
  const snapshotId = nextSnapshotId(serviceId, version);

  await db
    .insert(agentReputation)
    .values({
      serviceId,
      trustScore: newTrust,
      snapshotId,
      version,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: agentReputation.serviceId,
      set: {
        trustScore: newTrust,
        snapshotId,
        version,
        updatedAt: new Date(),
      },
    });

  return {
    newTrust,
    snapshotId,
    previousSnapshotId: prev.snapshotId,
    previousTrust: prev.trustScore,
  };
}
