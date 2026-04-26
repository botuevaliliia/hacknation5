import { withPayment } from "@moneydevkit/nextjs/server";
import { requireAgentOr401 } from "@/lib/agent-auth";
import { isDatabaseConfigured } from "@/db";
import { executeMarketplaceInvoke } from "@/lib/marketplace-invoke";

export const dynamic = "force-dynamic";

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
    marketplace_order_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json" } }, { status: 400 });
  }

  const result = await executeMarketplaceInvoke({
    serviceId: body.service_id ?? "",
    agentId: body.agent_id?.trim() || "anonymous_agent",
    task: (body.task ?? "").trim(),
    budgetUsd: Number(body.budget_usd),
    input: body.input ?? {},
    rankingEventId: body.ranking_event_id ?? null,
    marketplaceOrderId: body.marketplace_order_id ?? null,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    transaction_id: result.transactionId,
    service_id: result.serviceId,
    serviceId: result.serviceId,
    status: "feedback_required",
    result: result.result,
    cost_usd: result.costUsd,
    feedback_required: true,
    payment_note:
      "L402 payment required for this endpoint when INVOKE_REQUIRE_L402=true; use x-api-key for agent auth when retrying.",
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
  if (process.env.INVOKE_REQUIRE_L402 === "true") {
    return invokeWithPayment(req);
  }
  return invokeHandler(req);
}
