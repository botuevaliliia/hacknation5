import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Curated services for the agent marketplace (architecture §3, §11). */
export const agentServices = pgTable("agent_services", {
  serviceId: text("service_id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  providerServiceId: text("provider_service_id"),
  adapterType: text("adapter_type").notNull(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull(),
  description: text("description").notNull(),
  modelCard: text("model_card").notNull(),
  estimatedBaseCostUsd: real("estimated_base_cost_usd").notNull(),
  vetted: integer("vetted").notNull().default(1), // 0/1
  active: integer("active").notNull().default(1),
  trustScoreSeed: real("trust_score_seed").notNull().default(0.75),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentReputation = pgTable("agent_reputation", {
  serviceId: text("service_id").primaryKey(),
  trustScore: real("trust_score").notNull(),
  snapshotId: text("snapshot_id").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentTransactions = pgTable("agent_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: text("agent_id").notNull(),
  serviceId: text("service_id").notNull(),
  task: text("task").notNull(),
  inputPayload: text("input_payload").notNull().default("{}"),
  budgetUsd: real("budget_usd").notNull(),
  status: text("status").notNull(), // authorized | feedback_required | closed
  resultJson: jsonb("result_json").$type<Record<string, unknown> | null>(),
  costUsd: real("cost_usd"),
  feedbackJson: jsonb("feedback_json").$type<Record<string, unknown> | null>(),
  rankingEventId: text("ranking_event_id"),
  /** Linked buyer marketplace order when invoked via dashboard. */
  marketplaceOrderId: uuid("marketplace_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const agentRankingLog = pgTable("agent_ranking_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  rankingEventId: text("ranking_event_id").notNull().unique(),
  task: text("task").notNull(),
  budgetUsd: real("budget_usd").notNull(),
  rankerMode: text("ranker_mode").notNull(),
  modelId: text("model_id").notNull(),
  resultsJson: jsonb("results_json").$type<unknown>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A service offered by one agent to others (or to humans buying on behalf of agents). */
export const listings = pgTable("listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceSats: integer("price_sats").notNull(),
  /** Short public name for the seller for the directory. */
  sellerLabel: text("seller_label").notNull(),
  /** 0–100, used for “compare / trust” in the directory. */
  reputation: integer("reputation").notNull().default(70),
  /** Optional: base URL of an L402 or HTTP API the buyer’s agent can call after paying. */
  serviceUrl: text("service_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Supabase Auth user profile (public.users mirror). */
export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email"),
  displayName: text("display_name").notNull().default(""),
  /** Optional Lightning Address for payouts and settlement references. */
  lightningAddress: text("lightning_address"),
  /** 1 = opted into selling */
  isProvider: integer("is_provider").notNull().default(0),
  /** 1 = can buy (default) */
  isBuyer: integer("is_buyer").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providerAccounts = pgTable("provider_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique(),
  handle: text("handle").notNull().unique(),
  status: text("status").notNull().default("active"),
  payoutPrefsJson: jsonb("payout_prefs_json").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providerProducts = pgTable("provider_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerAccountId: uuid("provider_account_id").notNull(),
  type: text("type").notNull(), // agent | dataset | mcp_server
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceSats: integer("price_sats"),
  pricingModel: text("pricing_model").notNull().default("per_call"), // per_call | fixed | free
  /** Optional link to catalog row for invoke routing */
  linkedServiceId: text("linked_service_id"),
  endpointMetadata: jsonb("endpoint_metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providerAgentRegistrations = pgTable("provider_agent_registrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerAccountId: uuid("provider_account_id").notNull(),
  label: text("label").notNull(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  verificationState: text("verification_state").notNull().default("unverified"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const marketplaceOrders = pgTable("marketplace_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  buyerUserId: text("buyer_user_id").notNull(),
  providerProductId: uuid("provider_product_id").notNull(),
  amountSats: integer("amount_sats").notNull().default(0),
  amountUsd: real("amount_usd"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  agentTransactionId: uuid("agent_transaction_id"),
  paymentMetadata: jsonb("payment_metadata").$type<Record<string, unknown> | null>(),
  task: text("task").notNull().default(""),
  budgetUsd: real("budget_usd").notNull().default(1),
  inputPayload: jsonb("input_payload")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountType: text("account_type").notNull(), // platform | provider | buyer
  accountId: text("account_id").notNull(),
  orderId: uuid("order_id"),
  deltaSats: integer("delta_sats").notNull().default(0),
  deltaUsd: real("delta_usd"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerProductId: uuid("provider_product_id"),
  buyerUserId: text("buyer_user_id"),
  agentTransactionId: uuid("agent_transaction_id"),
  eventType: text("event_type").notNull(),
  meta: jsonb("meta")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
