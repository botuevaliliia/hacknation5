import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL");
  }
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  return drizzle(pool, { schema });
}

type Db = ReturnType<typeof createDb>;

let _db: Db | undefined;

export function getDb(): Db {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export { schema };
