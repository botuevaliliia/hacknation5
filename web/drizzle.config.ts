import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Same resolution order as local Next.js: .env then .env.local overrides.
config({ path: ".env" });
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
