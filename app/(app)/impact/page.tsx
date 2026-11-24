import { InsightsTabs } from "@/components/reports/InsightsTabs";
import { notFound } from "next/navigation";
import { reportableOrg } from "@/lib/actions/metrics";
import { getMembership } from "@/lib/org";
import { ImpactDashboard } from "@/components/impact/ImpactDashboard";

/** Impact: the dashboard that tells the story of the work, with a designed PDF export. */
export default async function ImpactPage() {
  // Reports are for admins and supervisors; case managers in an organization don't get them.
  const m = await getMembership();
  if (m?.active && m.role === "case_manager") notFound();
  const org = await reportableOrg();
  return (
    <>
      {m?.active && (
        <div className="mb-4">
          <InsightsTabs current="overview" />
        </div>
      )}
      <ImpactDashboard orgName={org?.name ?? null} />
    </>
  );
}
