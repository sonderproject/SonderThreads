import Link from "next/link";
import { notFound } from "next/navigation";
import { asUser } from "@/lib/db/as-user";
import { isUuid } from "@/lib/ids";
import { getTimeZone } from "@/lib/timezone";
import { requireTeamViewer, shortDate } from "@/lib/team";
import { ROLE_LABELS, type OrgRole } from "@/lib/org";

type Client = {
  id: string;
  display_name: string;
  current_status: string | null;
  needs_followup: boolean;
  last_activity_at: string;
  open_tasks: number;
  overdue: number;
};

/** One staff member's caseload, read-only. */
export default async function StaffCaseloadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: staffId } = await params;
  if (!isUuid(staffId)) notFound();
  const viewer = await requireTeamViewer();
  const tz = await getTimeZone();
  const [member, clients] = await asUser(viewer.userId, async (q) => [
    (
      await q<{ name: string | null; email: string; role: OrgRole; active: boolean }>(
        `select u.name, u.email, m.role, m.active from memberships m join users u on u.id = m.user_id
          where m.org_id = $1 and m.user_id = $2`,
        [viewer.orgId, staffId],
      )
    )[0],
    await q<Client>(
      `select p.id, p.display_name, p.current_status, p.needs_followup, p.last_activity_at,
              (select count(*) from tasks t where t.person_id = p.id and t.deleted_at is null and not t.completed)::int as open_tasks,
              (select count(*) from tasks t where t.person_id = p.id and t.deleted_at is null and not t.completed and t.due_at < now())::int as overdue
         from people p
        where p.user_id = $1 and p.org_id = $2 and p.deleted_at is null
        order by p.needs_followup desc, p.display_name`,
      [staffId, viewer.orgId],
    ),
  ]);
  if (!member) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/team" className="text-sm text-accent hover:underline">
          ← Team
        </Link>
        <h1 className="page-title">{member.name || member.email}</h1>
        <p className="text-sm text-text-muted">
          {ROLE_LABELS[member.role]}
          {!member.active && " · deactivated"} · {clients.length} {clients.length === 1 ? "client" : "clients"}
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="card p-4 text-sm text-text-muted">No {viewer.orgName} clients.</div>
      ) : (
        <ul className="card divide-y divide-border-subtle">
          {clients.map((c) => (
            <li key={c.id} className={c.overdue > 0 ? "flag-urgent" : c.needs_followup ? "flag-attention" : ""}>
              <Link href={`/team/client/${c.id}`} className="flex items-start justify-between gap-3 p-4 hover:bg-bg-hover">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{c.display_name}</p>
                  <p className="text-xs text-text-faint">Last activity {shortDate(c.last_activity_at, tz)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  {c.needs_followup && <span className="tag tag-e">Follow up</span>}
                  {c.overdue > 0 && <span className="tag tag-u">{c.overdue} overdue</span>}
                  {c.open_tasks > 0 && <span className="text-text-muted tabular-nums">{c.open_tasks} open tasks</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
