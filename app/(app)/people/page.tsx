import { PeopleBrowser } from "@/components/people/PeopleBrowser";
import { listPeople } from "@/lib/actions/people";
import { getMembership } from "@/lib/org";

/**
 * People. Organization members share one caseload: everyone sees, edits and
 * can delete every agency client. Personal (private) people stay with their owner.
 */
export default async function PeoplePage() {
  const [people, membership] = await Promise.all([listPeople(), getMembership()]);
  return (
    <div className="space-y-4">
      <h1 className="page-title">People</h1>
      <PeopleBrowser people={people} orgName={membership?.active ? membership.orgName : null} />
    </div>
  );
}
