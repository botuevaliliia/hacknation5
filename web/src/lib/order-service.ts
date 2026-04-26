import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { executeMarketplaceInvoke, externalEndpointFromProduct } from "@/lib/marketplace-invoke";

const {
  marketplaceOrders,
  providerProducts,
  providerAccounts,
  ledgerEntries,
  usageEvents,
  agentTransactions,
  agentServices,
} =
  schema;

const PLATFORM_CUT_BPS = 1000; // 10%

/** Adapters implemented in `invokeProvider` for marketplace purchases. */
const MARKETPLACE_INVOKABLE_ADAPTERS = new Set([
  "openrouter",
  "tavily",
  "exa",
  "serper",
  "firecrawl",
  "http_external",
]);

export async function placeOrderForUser(input: {
  buyerUserId: string;
  productId: string;
  task: string;
  budgetUsd: number;
  invokeInput: Record<string, unknown>;
  buyerAgentLabel: string;
}): Promise<
  | { ok: true; orderId: string; transactionId: string; costUsd: number }
  | { ok: false; status: number; error: Record<string, unknown> }
> {
  const db = getDb();
  const [product] = await db
    .select()
    .from(providerProducts)
    .where(eq(providerProducts.id, input.productId));
  if (!product || !product.active) {
    return { ok: false, status: 404, error: { message: "Product not found" } };
  }
  const [provider] = await db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.id, product.providerAccountId));
  if (provider?.ownerUserId === input.buyerUserId) {
    return {
      ok: false,
      status: 400,
      error: {
        message:
          "Self-trade is disabled. Use a different buyer account to purchase your own provider listing.",
      },
    };
  }
  const linked = product.linkedServiceId?.trim();
  if (!linked) {
    return {
      ok: false,
      status: 400,
      error: { message: "Product must link a catalog service_id for invoke" },
    };
  }

  const [svc] = await db.select().from(agentServices).where(eq(agentServices.serviceId, linked));
  if (!svc || !svc.active) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "unknown_service",
        message:
          "This listing points to an unknown or inactive catalog service. Edit the product in My services and set a valid service ID.",
      },
    };
  }
  const external = externalEndpointFromProduct(product);
  if (svc.adapterType === "http_external") {
    if (!external?.baseUrl?.trim()) {
      return {
        ok: false,
        status: 400,
        error: {
          code: "external_endpoint_required",
          message:
            "This listing uses a deployed HTTP agent but has no base URL. Open My services → Edit and set Base URL (and usually a unique service ID).",
        },
      };
    }
  } else if (!MARKETPLACE_INVOKABLE_ADAPTERS.has(svc.adapterType)) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "adapter_not_invokable",
        message: `Catalog adapter "${svc.adapterType}" cannot be invoked from the marketplace in this build. Edit the listing: use a custom service ID with Base URL (http_external), or pick OpenRouter / Tavily / Firecrawl / etc.`,
        hint: "Mis-typed IDs often point at demo catalog rows (e.g. apify_crawler) while your agent runs elsewhere.",
      },
    };
  }

  const amountSats = product.priceSats ?? 100;

  const [order] = await db
    .insert(marketplaceOrders)
    .values({
      buyerUserId: input.buyerUserId,
      providerProductId: product.id,
      amountSats,
      amountUsd: input.budgetUsd,
      paymentStatus: "paid",
      deliveryStatus: "in_progress",
      task: input.task.slice(0, 2000),
      budgetUsd: input.budgetUsd,
      inputPayload: input.invokeInput,
    })
    .returning();

  const platformCut = Math.floor((amountSats * PLATFORM_CUT_BPS) / 10_000);
  const providerCredit = amountSats - platformCut;

  await db.insert(ledgerEntries).values({
    accountType: "buyer",
    accountId: input.buyerUserId,
    orderId: order.id,
    deltaSats: -amountSats,
    deltaUsd: -input.budgetUsd,
    reason: "marketplace_order_debit",
  });
  await db.insert(ledgerEntries).values({
    accountType: "provider",
    accountId: product.providerAccountId,
    orderId: order.id,
    deltaSats: providerCredit,
    deltaUsd: null,
    reason: "marketplace_order_credit",
  });
  if (platformCut > 0) {
    await db.insert(ledgerEntries).values({
      accountType: "platform",
      accountId: "platform",
      orderId: order.id,
      deltaSats: platformCut,
      deltaUsd: null,
      reason: "platform_fee",
    });
  }

  const inv = await executeMarketplaceInvoke({
    serviceId: linked,
    agentId: input.buyerAgentLabel,
    task: input.task,
    budgetUsd: input.budgetUsd,
    input: input.invokeInput,
    marketplaceOrderId: order.id,
    externalEndpoint: externalEndpointFromProduct(product),
  });

  if (!inv.ok) {
    await db
      .update(marketplaceOrders)
      .set({
        deliveryStatus: "failed",
        agentTransactionId: inv.transactionId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceOrders.id, order.id));
    return { ok: false, status: inv.status, error: inv.error };
  }

  await db
    .update(marketplaceOrders)
    .set({
      agentTransactionId: inv.transactionId,
      deliveryStatus: "delivered_pending_feedback",
      updatedAt: new Date(),
    })
    .where(eq(marketplaceOrders.id, order.id));

  await db.insert(usageEvents).values({
    providerProductId: product.id,
    buyerUserId: input.buyerUserId,
    agentTransactionId: inv.transactionId,
    eventType: "invoke",
    meta: { orderId: order.id, serviceId: linked, costUsd: inv.costUsd },
  });

  return {
    ok: true,
    orderId: order.id,
    transactionId: inv.transactionId,
    costUsd: inv.costUsd,
  };
}

export async function assertOrderBuyer(orderId: string, buyerUserId: string): Promise<boolean> {
  const db = getDb();
  const [o] = await db.select().from(marketplaceOrders).where(eq(marketplaceOrders.id, orderId));
  return Boolean(o && o.buyerUserId === buyerUserId);
}

export async function getOrderByTransactionId(transactionId: string) {
  const db = getDb();
  const [tx] = await db.select().from(agentTransactions).where(eq(agentTransactions.id, transactionId));
  if (!tx?.marketplaceOrderId) return null;
  const [order] = await db
    .select()
    .from(marketplaceOrders)
    .where(eq(marketplaceOrders.id, tx.marketplaceOrderId));
  return order ?? null;
}
