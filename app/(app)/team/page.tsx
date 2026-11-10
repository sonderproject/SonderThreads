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
  const [staff, logo] = await asUser(viewer.userId, async (q) => [
    await q<Row>(
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
    (
      await q<{ v: string | null }>(`select extract(epoch from logo_updated_at)::bigint::text as v from organizations where id = $1`, [
        viewer.orgId,
      ])
    )[0]?.v ?? null,
  ]);
  const totals = staff.reduce(
    (a, r) => ({ clients: a.clients + r.clients, overdue: a.overdue + r.overdue, followups: a.followups + r.followups }),
    { clients: 0, overdue: 0, followups: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/org-logo?v=${logo}`} alt={`${viewer.orgName} logo`} className="mb-2 max-h-12 max-w-40 object-contain" />
        )}
        <p className="eyebrow text-text-faint">{viewer.orgName}</p>
        <h1 className="page-title">Team</h1>
        {viewer.role === "admin" && (
          <Link href="/team/log" className="inline-block text-sm text-accent hover:underline">
            Activity log →
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4 sm:col-span-2" style={{ borderColor: "var(--accent)" }}>
          <p className="eyebrow text-text-faint">Organization clients</p>
          <p className="font-display text-4xl font-light tabular-nums">{totals.clients}</p>
          <p className="text-xs text-text-muted">
            Shared with all {staff.length} staff. Everyone can see, add to and edit every one.
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow text-text-faint">Need follow-up</p>
          <p className="font-display text-4xl font-light tabular-nums">{totals.followups}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow text-text-faint">Overdue tasks</p>
          <p className="font-display text-4xl font-light tabular-nums">{totals.overdue}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="eyebrow border-b border-border text-left text-text-faint">
              <th className="px-4 py-2 font-semibold">Staff</th>
              <th className="px-3 py-2 text-right font-semibold">Clients they added</th>
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
        &quot;Clients they added&quot; is who entered each client, not who can see it. Staff members&apos; personal tasks
        and notes are never shown here.
      </p>
    </div>
  );
}
