import { desc } from "drizzle-orm";
import { getDb, isDatabaseConfigured, schema } from "@/db";

const { agentTransactions, agentRankingLog, agentServices, agentReputation } = schema;

export async function loadObservabilitySnapshot() {
  if (!isDatabaseConfigured()) {
    return null;
  }
  const db = getDb();
  const [txns, ranks, svcs, reps] = await Promise.all([
    db
      .select()
      .from(agentTransactions)
      .orderBy(desc(agentTransactions.createdAt))
      .limit(30),
    db
      .select()
      .from(agentRankingLog)
      .orderBy(desc(agentRankingLog.createdAt))
      .limit(15),
    db.select().from(agentServices).limit(50),
    db.select().from(agentReputation),
  ]);
  return { transactions: txns, rankingLogs: ranks, services: svcs, reputation: reps };
}
