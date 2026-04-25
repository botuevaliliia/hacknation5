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

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
