import { withPayment } from "@moneydevkit/nextjs/server";
import { eq } from "drizzle-orm";
import { requireAgentOr401 } from "@/lib/agent-auth";
import { getDb, isDatabaseConfigured, schema } from "@/db";
import { invokeProvider } from "@/marketplace/gateway/invoke";

export const dynamic = "force-dynamic";

const { agentServices, agentTransactions } = schema;

async function invokeHandler(req: Request) {
  const denied = requireAgentOr401(req);
  if (denied) {
    return denied;
  }
  if (!isDatabaseConfigured()) {
    return Response.json({ error: { code: "database_required" } }, { status: 503 });
  }

  let body: {
    service_id?: string;
    agent_id?: string;
    task?: string;
    budget_usd?: number;
    input?: Record<string, unknown>;
    ranking_event_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const serviceId = body.service_id?.trim();
  const agentId = body.agent_id?.trim() || "anonymous_agent";
  const task = (body.task ?? "").trim();
  const budget = Number(body.budget_usd);
  const input = body.input ?? {};

  if (!serviceId) {
    return Response.json({ error: { message: "service_id required" } }, { status: 400 });
  }
  if (task.length < 1) {
    return Response.json({ error: { message: "task required" } }, { status: 400 });
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return Response.json({ error: { message: "budget_usd invalid" } }, { status: 400 });
  }

  const db = getDb();
  const [svc] = await db.select().from(agentServices).where(eq(agentServices.serviceId, serviceId));
  if (!svc || !svc.active) {
    return Response.json({ error: { message: "Unknown or inactive service" } }, { status: 404 });
  }

  const est = svc.estimatedBaseCostUsd;
  if (est > budget) {
    return Response.json(
      {
        error: {
          code: "budget_exceeded",
          message: `Estimated cost ${est} USD exceeds budget ${budget}`,
        },
      },
      { status: 400 },
    );
  }

  const inv = await invokeProvider(svc.adapterType, svc.providerServiceId, input);
  const cost = inv.costUsd > 0 ? inv.costUsd : est;

  const [row] = await db
    .insert(agentTransactions)
    .values({
      agentId,
      serviceId,
      task: task.slice(0, 8000),
      inputPayload: JSON.stringify(input).slice(0, 12_000),
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
      rankingEventId: body.ranking_event_id ?? null,
    })
    .returning();

  return Response.json({
    transaction_id: row.id,
    service_id: serviceId,
    serviceId,
    status: "feedback_required",
    result: inv.output,
    cost_usd: cost,
    feedback_required: true,
    payment_note:
      "L402 payment required for this endpoint; pass agent auth in x-api-key (not Authorization) when retrying.",
  });
}

const invokeWithPayment = withPayment(
  {
    amount: 10,
    currency: "SAT",
    expirySeconds: 900,
  },
  invokeHandler,
);

export async function POST(req: Request) {
  // Keep payment enforceable, but allow local/autonomous testing without MDK credentials.
  if (process.env.INVOKE_REQUIRE_L402 === "true") {
    return invokeWithPayment(req);
  }
  return invokeHandler(req);
}
