import Link from "next/link";
import { asUser } from "@/lib/db/as-user";
import { requireTeamViewer } from "@/lib/team";
import { ROLE_LABELS, type OrgRole } from "@/lib/org";

type Row = {
  user_id: string;
  name: string | null;
  email: string;
  role: OrgRole;
  clients: number;
  followups: number;
  open_tasks: number;
  overdue: number;
};

/** Team: each staff member's caseload at a glance (admins and supervisors). */
export default async function TeamPage() {
  const viewer = await requireTeamViewer();
  const staff = await asUser(viewer.userId, (q) =>
    q<Row>(
      `select m.user_id, u.name, u.email, m.role,
              (select count(*) from people p where p.user_id = m.user_id and p.org_id = m.org_id and p.deleted_at is null)::int as clients,
              (select count(*) from people p where p.user_id = m.user_id and p.org_id = m.org_id and p.deleted_at is null and p.needs_followup)::int as followups,
              (select count(*) from tasks t where t.user_id = m.user_id and t.org_id = m.org_id and t.deleted_at is null and not t.completed)::int as open_tasks,
              (select count(*) from tasks t where t.user_id = m.user_id and t.org_id = m.org_id and t.deleted_at is null and not t.completed
                 and t.due_at < now())::int as overdue
         from memberships m join users u on u.id = m.user_id
        where m.org_id = $1 and m.active
        order by coalesce(u.name, u.email)`,
      [viewer.orgId],
    ),
  );
  const totals = staff.reduce(
    (a, r) => ({ clients: a.clients + r.clients, overdue: a.overdue + r.overdue, followups: a.followups + r.followups }),
    { clients: 0, overdue: 0, followups: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">{viewer.orgName}</p>
        <h1 className="page-title">Team</h1>
        <p className="text-sm text-text-muted">
          {staff.length} staff · {totals.clients} clients · {totals.followups} need follow-up · {totals.overdue} overdue
          tasks
        </p>
        {viewer.role === "admin" && (
          <Link href="/team/log" className="inline-block text-sm text-accent hover:underline">
            Activity log →
          </Link>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="eyebrow border-b border-border text-left text-text-faint">
              <th className="px-4 py-2 font-semibold">Staff</th>
              <th className="px-3 py-2 text-right font-semibold">Clients</th>
              <th className="px-3 py-2 text-right font-semibold">Follow-up</th>
              <th className="px-3 py-2 text-right font-semibold">Open tasks</th>
              <th className="px-4 py-2 text-right font-semibold">Overdue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {staff.map((r) => (
              <tr key={r.user_id} className="hover:bg-bg-hover">
                <td className="px-4 py-3">
                  <Link href={`/team/${r.user_id}`} className="block">
                    <span className="font-semibold text-text">{r.name || r.email}</span>
                    {r.user_id === viewer.userId && <span className="text-text-muted"> (you)</span>}
                    <span className="block text-xs text-text-muted">{ROLE_LABELS[r.role]}</span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{r.clients}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {r.followups > 0 ? <span className="tag tag-e">{r.followups}</span> : 0}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{r.open_tasks}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.overdue > 0 ? <span className="tag tag-u">{r.overdue}</span> : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-faint">
        Only clients that belong to {viewer.orgName} are counted. Staff members&apos; personal tasks and notes are never
        shown here.
      </p>
    </div>
  );
}
