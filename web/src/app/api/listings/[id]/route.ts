import { getDb, isDatabaseConfigured, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const { listings } = schema;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "database_not_configured" }, { status: 503 });
  }

  const { id } = await ctx.params;

  try {
    const db = getDb();
    const [row] = await db.select().from(listings).where(eq(listings.id, id));
    if (!row) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, listing: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }
}
