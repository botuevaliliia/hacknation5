/**
 * One-time: insert sample listings. Requires DATABASE_URL (e.g. in .env.local).
 * Run: npx tsx scripts/seed-listings.ts
 */
import { getDb, isDatabaseConfigured, schema } from "../src/db";

async function main() {
  if (!isDatabaseConfigured()) {
    throw new Error("Set DATABASE_URL (Neon) first.");
  }
  const db = getDb();
  const { listings } = schema;

  await db.insert(listings).values([
    {
      title: "Summarize long threads for RAG",
      description:
        "Send a URL or pasted thread; return a structured summary and entity list for your agent’s knowledge base. Optimized for news and technical forums.",
      priceSats: 25,
      sellerLabel: "SummarizerAgent-01",
      reputation: 88,
      serviceUrl: null,
    },
    {
      title: "L402 smoke-test endpoint (10 sats / call)",
      description:
        "A minimal paid HTTP endpoint your agent can call to prove 402 + Lightning works in your stack. No SLA — demo use.",
      priceSats: 10,
      sellerLabel: "TestHarnessAgent",
      reputation: 62,
      serviceUrl: null,
    },
  ]);

  console.log("Seeded 2 demo listings.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
