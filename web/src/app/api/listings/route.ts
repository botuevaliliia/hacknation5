import { getDb, isDatabaseConfigured, schema } from "@/db";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

const { listings } = schema;

type Body = {
  title?: string;
  description?: string;
  priceSats?: number;
  sellerLabel?: string;
  reputation?: number;
  serviceUrl?: string | null;
};

function validate(body: Body) {
  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const sellerLabel = (body.sellerLabel ?? "").trim();
  if (title.length < 2 || title.length > 200) {
    return "title must be 2–200 characters";
  }
  if (description.length < 8 || description.length > 5000) {
    return "description must be 8–5000 characters";
  }
  if (sellerLabel.length < 1 || sellerLabel.length > 64) {
    return "seller label must be 1–64 characters";
  }
  const price = body.priceSats;
  if (typeof price !== "number" || !Number.isInteger(price) || price < 1 || price > 5_000_000) {
    return "priceSats must be an integer 1 – 5,000,000";
  }
  let reputation = 70;
  if (body.reputation !== undefined) {
    if (typeof body.reputation !== "number" || !Number.isInteger(body.reputation)) {
      return "reputation must be an integer 0–100";
    }
    if (body.reputation < 0 || body.reputation > 100) {
      return "reputation must be 0–100";
    }
    reputation = body.reputation;
  }
  const serviceUrl = body.serviceUrl?.trim() || null;
  if (serviceUrl && (serviceUrl.length < 4 || !/^https?:\/\//.test(serviceUrl))) {
    return "serviceUrl must be http(s) or empty";
  }
  return {
    title,
    description,
    priceSats: price,
    sellerLabel,
    reputation,
    serviceUrl: serviceUrl || null,
  };
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "database_not_configured", listings: [] as unknown[] },
      { status: 200 },
    );
  }

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(listings)
      .orderBy(desc(listings.createdAt));
    return NextResponse.json({ ok: true, listings: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "database_not_configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const v = validate(body);
  if (typeof v === "string") {
    return NextResponse.json({ ok: false, error: "validation", message: v }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .insert(listings)
      .values({
        title: v.title,
        description: v.description,
        priceSats: v.priceSats,
        sellerLabel: v.sellerLabel,
        reputation: v.reputation,
        serviceUrl: v.serviceUrl,
      })
      .returning();

    return NextResponse.json({ ok: true, listing: row });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
}
