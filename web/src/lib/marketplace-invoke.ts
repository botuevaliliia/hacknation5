import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { invokeProvider } from "@/marketplace/gateway/invoke";

const { agentServices, agentTransactions } = schema;

export type MarketplaceInvokeInput = {
  serviceId: string;
  agentId: string;
  task: string;
  budgetUsd: number;
  input: Record<string, unknown>;
  rankingEventId?: string | null;
  marketplaceOrderId?: string | null;
};

export type MarketplaceInvokeResult =
  | {
      ok: true;
      transactionId: string;
      serviceId: string;
      result: Record<string, unknown>;
      costUsd: number;
    }
  | {
      ok: false;
      status: number;
      error: Record<string, unknown>;
    };

export async function executeMarketplaceInvoke(
  input: MarketplaceInvokeInput,
): Promise<MarketplaceInvokeResult> {
  const db = getDb();
  const serviceId = input.serviceId.trim();
  const task = input.task.trim();
  const budget = Number(input.budgetUsd);

  if (!serviceId) {
    return { ok: false, status: 400, error: { message: "service_id required" } };
  }
  if (task.length < 1) {
    return { ok: false, status: 400, error: { message: "task required" } };
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return { ok: false, status: 400, error: { message: "budget_usd invalid" } };
  }

  const [svc] = await db.select().from(agentServices).where(eq(agentServices.serviceId, serviceId));
  if (!svc || !svc.active) {
    return { ok: false, status: 404, error: { message: "Unknown or inactive service" } };
  }

  const est = svc.estimatedBaseCostUsd;
  if (est > budget) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "budget_exceeded",
        message: `Estimated cost ${est} USD exceeds budget ${budget}`,
      },
    };
  }

  const inv = await invokeProvider(svc.adapterType, svc.providerServiceId, input.input);
  const cost = inv.costUsd > 0 ? inv.costUsd : est;

  const [row] = await db
    .insert(agentTransactions)
    .values({
      agentId: input.agentId,
      serviceId,
      task: task.slice(0, 8000),
      inputPayload: JSON.stringify(input.input).slice(0, 12_000),
      budgetUsd: budget,
      status: "feedback_required",
      resultJson: {
        ...inv.output,
        success: inv.success,
        latencyMs: inv.latencyMs,
        error: inv.error,
        rawProvider: inv.rawProvider,
      } as Record<string, unknown>,
      costUsd: cost,
      rankingEventId: input.rankingEventId ?? null,
      marketplaceOrderId: input.marketplaceOrderId ?? null,
    })
    .returning();

  return {
    ok: true,
    transactionId: row.id,
    serviceId,
    result: inv.output,
    costUsd: cost,
  };
}
