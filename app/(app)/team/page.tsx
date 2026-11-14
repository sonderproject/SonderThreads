import Link from "next/link";
import { SeatSummary } from "@/components/org/SeatSummary";
import { seatUsage } from "@/lib/billing";
import { asUser } from "@/lib/db/as-user";
import { requireTeamViewer } from "@/lib/team";
import { ROLE_LABELS, type OrgRole } from "@/lib/org";
import { countNewReferrals } from "@/lib/referrals";
import { getOrgTimeZone } from "@/lib/referral-settings";
import { getTerms } from "@/lib/terms-server";
import { getOrgChecklist } from "@/lib/org-checklist";
import { OrgChecklist } from "@/components/org/OrgChecklist";
import { SampleData } from "@/components/home/SampleData";
import { canLoadSampleData, hasSampleData } from "@/lib/actions/sample";

type Row = {
  user_id: string;
  name: string | null;
  email: string;
  role: OrgRole;
  clients: number;
  check_ins_today: number;
  services_today: number;
};

/** Team: each staff member's clients and today's check-ins and services (admins and supervisors). Tasks and follow-ups stay private to each member. */
export default async function TeamPage() {
  const viewer = await requireTeamViewer();
  const [tz, terms] = await Promise.all([getOrgTimeZone(viewer.orgId), getTerms()]);
  const [staff, logo] = await asUser(viewer.userId, async (q) => [
    await q<Row>(
      `select m.user_id, u.name, u.email, m.role,
              (select count(*) from people p where p.user_id = m.user_id and p.org_id = m.org_id and p.deleted_at is null)::int as clients,
              (select count(*) from check_ins c where c.user_id = m.user_id and c.org_id = m.org_id and c.deleted_at is null
                 and (c.checked_in_at at time zone $2)::date = (now() at time zone $2)::date)::int as check_ins_today,
              (select count(*) from check_ins c where c.user_id = m.user_id and c.org_id = m.org_id and c.deleted_at is null
                 and c.service_id is not null
                 and (c.checked_in_at at time zone $2)::date = (now() at time zone $2)::date)::int as services_today
         from memberships m join users u on u.id = m.user_id
        where m.org_id = $1 and m.active
        order by coalesce(u.name, u.email)`,
      [viewer.orgId, tz],
    ),
    (
      await q<{ v: string | null }>(`select extract(epoch from logo_updated_at)::bigint::text as v from organizations where id = $1`, [
        viewer.orgId,
      ])
    )[0]?.v ?? null,
  ]);
  const totals = staff.reduce(
    (a, r) => ({ clients: a.clients + r.clients, checkIns: a.checkIns + r.check_ins_today, services: a.services + r.services_today }),
    { clients: 0, checkIns: 0, services: 0 },
  );

  const newReferrals = viewer.role === "admin" ? await countNewReferrals(viewer.orgId) : 0;
  const seats = viewer.role === "admin" ? await seatUsage(viewer.orgId) : null;
  const [checklist, sampleIn, sampleOffer] =
    viewer.role === "admin"
      ? await Promise.all([getOrgChecklist(viewer.orgId, terms.impact), hasSampleData(), canLoadSampleData()])
      : [null, false, false];
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
          <div className="flex flex-wrap gap-4">
            <Link href="/team/log" className="inline-block text-sm text-accent hover:underline">
              Activity log →
            </Link>
            {newReferrals > 0 && (
              <Link href="/referrals" className="inline-block text-sm font-medium text-accent hover:underline">
                {newReferrals} new {newReferrals === 1 ? "referral" : "referrals"} →
              </Link>
            )}
          </div>
        )}
      </div>
      {checklist && <OrgChecklist items={checklist} />}
      {sampleIn ? <SampleData mode="loaded" /> : sampleOffer && <SampleData mode="offer" />}
      {seats && <SeatSummary seats={seats} canManage />}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4 sm:col-span-2" style={{ borderColor: "var(--accent)" }}>
          <p className="eyebrow text-text-faint">Organization clients</p>
          <p className="font-display text-4xl font-light tabular-nums">{totals.clients}</p>
          <p className="text-xs text-text-muted">
            Shared with all {staff.length} staff. Everyone can see, add to and edit every one.
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow text-text-faint">{terms.checkIns} today</p>
          <p className="font-display text-4xl font-light tabular-nums">{totals.checkIns}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow text-text-faint">Services today</p>
          <p className="font-display text-4xl font-light tabular-nums">{totals.services}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="eyebrow border-b border-border text-left text-text-faint">
              <th className="px-4 py-2 font-semibold">Staff</th>
              <th className="px-3 py-2 text-right font-semibold">Clients they added</th>
              <th className="px-3 py-2 text-right font-semibold">{terms.checkIns} today</th>
              <th className="px-4 py-2 text-right font-semibold">Services today</th>
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
                <td className="px-3 py-3 text-right tabular-nums">{r.check_ins_today}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.services_today}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-faint">
        &quot;Clients they added&quot; is who entered each client, not who can see it. Today follows the organization&apos;s
        time zone. Staff members&apos; tasks, follow-ups and notes stay private to them.
      </p>
    </div>
  );
}
