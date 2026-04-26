import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ServicesPage() {
  // Keep one source of truth for catalog/service contracts on marketplace view.
  redirect("/dashboard/market");
}
