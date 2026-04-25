import { loadObservabilitySnapshot } from "@/marketplace/observability-data";

export const dynamic = "force-dynamic";

/** Read-only human observability (architecture §11, §13). GET only; no mutations. */
export async function GET() {
  const data = await loadObservabilitySnapshot();
  if (!data) {
    return Response.json({ ok: false, error: "database_not_configured" });
  }
  return Response.json({ ok: true, ...data });
}
