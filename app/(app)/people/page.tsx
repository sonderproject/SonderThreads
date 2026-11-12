import Link from "next/link";
import { PeopleBrowser } from "@/components/people/PeopleBrowser";
import { listPeople } from "@/lib/actions/people";
import { getMembership } from "@/lib/org";
import { listServices, peopleServiceIds } from "@/lib/services";

/**
 * People. Organization members share one caseload: everyone sees, edits and
 * can delete every agency client. Personal (private) people stay with their owner.
 */
export default async function PeoplePage() {
  const [people, membership, services, serviceUse] = await Promise.all([
    listPeople(),
    getMembership(),
    listServices({ includeArchived: true }),
    peopleServiceIds(),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">People</h1>
        <Link href="/settings/data#import" className="text-sm text-accent hover:underline">
          Import a client list
        </Link>
      </div>
      <PeopleBrowser
        people={people}
        orgName={membership?.active ? membership.orgName : null}
        services={services.filter((s) => Object.values(serviceUse).some((ids) => ids.includes(s.id)))}
        serviceUse={serviceUse}
      />
    </div>
  );
}
