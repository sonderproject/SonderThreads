import { reportableOrg } from "@/lib/actions/metrics";
import { ImpactDashboard } from "@/components/impact/ImpactDashboard";

/** Impact: the dashboard that tells the story of the work, with a designed PDF export. */
export default async function ImpactPage() {
  const org = await reportableOrg();
  return <ImpactDashboard orgName={org?.name ?? null} />;
}
