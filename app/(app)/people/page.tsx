import Link from "next/link";
import { PeopleBrowser } from "@/components/people/PeopleBrowser";
import { OrgClientList, type OrgClientRow } from "@/components/people/OrgClientList";
import { listPeople } from "@/lib/actions/people";
import { getMembership } from "@/lib/org";
import { requireUserId } from "@/lib/current-user";
import { asUser } from "@/lib/db/as-user";

/**
 * People. Organization members also get "Everyone at <org>": every agency
 * client with their case manager (a shared caseload), read through the database's access rules
 * (others' clients open read-only in the Team view).
 */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const userId = await requireUserId();
  const [people, membership] = await Promise.all([listPeople(), getMembership()]);
  const canSeeOrg = Boolean(membership?.active);
  const showOrg = canSeeOrg && view === "org";

  const orgClients = showOrg
    ? await asUser(userId, (q) =>
        q<OrgClientRow>(
          `select p.id, p.display_name, coalesce(u.name, u.email) as owner, p.user_id = $2 as mine,
                  p.needs_followup, p.last_activity_at
             from people p join users u on u.id = p.user_id
            where p.org_id = $1 and p.deleted_at is null
            order by p.display_name`,
          [membership!.orgId, userId],
        ),
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">People</h1>
        {canSeeOrg && (
          <div className="inline-flex rounded-full border border-border bg-bg-raised p-0.5 text-xs" role="group" aria-label="Whose clients">
            <Link
              href="/people"
              aria-pressed={!showOrg}
              className={`rounded-full px-3 py-1 font-medium ${!showOrg ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}
            >
              Mine
            </Link>
            <Link
              href="/people?view=org"
              aria-pressed={showOrg}
              className={`rounded-full px-3 py-1 font-medium ${showOrg ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}
            >
              Everyone at {membership!.orgName}
            </Link>
          </div>
        )}
      </div>
      {showOrg ? (
        <OrgClientList clients={orgClients} />
      ) : (
        <PeopleBrowser people={people} orgName={membership?.active ? membership.orgName : null} />
      )}
    </div>
  );
}
