import Link from "next/link";
import { notFound } from "next/navigation";
import { asUser } from "@/lib/db/as-user";
import { isUuid } from "@/lib/ids";
import { requireTeamViewer, shortDate } from "@/lib/team";
import { ROLE_LABELS, type OrgRole } from "@/lib/org";
import { getOrgTimeZone } from "@/lib/referral-settings";
import { getTerms } from "@/lib/terms-server";
import { dayKey } from "@/lib/tz";
import { isDayKey, makeKey, parseKey } from "@/lib/calendar-items";
import { memberBusyMonth } from "@/lib/team-calendar";
import { MemberCalendar } from "@/components/team/MemberCalendar";
import { formatSlot } from "@/lib/referral-slots";
import { STATUS_LABELS, type ReferralStatus } from "@/lib/referrals";
import { formatMoney } from "@/lib/money";

type CheckIn = {
  id: string;
  person_id: string;
  display_name: string;
  checked_in_at: string;
  reason: string | null;
  service: string | null;
  amount_cents: number | null;
};

type Referral = {
  id: string;
  first_name: string;
  last_name: string;
  status: ReferralStatus;
  appointment_at: string | null;
  handled_at: string | null;
};

const STATUS_TONE: Record<ReferralStatus, string> = { new: "tag-e", accepted: "tag-n", matched: "tag-v", declined: "tag-u" };

/**
 * One member, view-only, for admins and managers: today's check-ins and
 * services, their month (tasks show only as "Busy"), and referrals they
 * handled (admins). Tasks and follow-ups stay private to the member; longer
 * trends live on the Impact page.
 */
export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { userId: staffId } = await params;
  if (!isUuid(staffId)) notFound();
  const viewer = await requireTeamViewer();
  const { month } = await searchParams;
  const [tz, terms] = await Promise.all([getOrgTimeZone(viewer.orgId), getTerms()]);
  const today = dayKey(new Date(), tz);
  const anchor = isDayKey(month) ? month : today;

  const [member, checkIns, referrals] = await asUser(viewer.userId, async (q) => [
    (
      await q<{ name: string | null; email: string; role: OrgRole; active: boolean }>(
        `select u.name, u.email, m.role, m.active from memberships m join users u on u.id = m.user_id
          where m.org_id = $1 and m.user_id = $2`,
        [viewer.orgId, staffId],
      )
    )[0],
    await q<CheckIn>(
      `select c.id, c.person_id, p.display_name, c.checked_in_at, c.reason, s.name as service, c.amount_cents
         from check_ins c
         join people p on p.id = c.person_id
         left join services s on s.id = c.service_id
        where c.user_id = $1 and c.org_id = $2 and c.deleted_at is null
          and (c.checked_in_at at time zone $3)::date = (now() at time zone $3)::date
        order by c.checked_in_at desc`,
      [staffId, viewer.orgId, tz],
    ),
    viewer.role === "admin"
      ? await q<Referral>(
          `select id, first_name, last_name, status, appointment_at, handled_at from referrals
            where org_id = $1 and handled_by = $2
            order by coalesce(appointment_at, handled_at, created_at) desc limit 10`,
          [viewer.orgId, staffId],
        )
      : [],
  ]);
  if (!member) notFound();

  const { items, range } = await memberBusyMonth(viewer.orgId, staffId, anchor, tz);
  const { year, month: m } = parseKey(anchor);
  const monthHref = (y: number, mo: number) => {
    const d = new Date(Date.UTC(y, mo - 1, 1));
    return `/team/${staffId}?month=${makeKey(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)}`;
  };

  const services = new Map<string, { count: number; cents: number; priced: boolean }>();
  for (const c of checkIns) {
    if (!c.service) continue;
    const s = services.get(c.service) ?? { count: 0, cents: 0, priced: false };
    s.count += 1;
    if (c.amount_cents !== null) {
      s.cents += c.amount_cents;
      s.priced = true;
    }
    services.set(c.service, s);
  }
  const time = (at: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(at));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/team" className="text-sm text-accent hover:underline">
          ← Team
        </Link>
        <h1 className="page-title">{member.name || member.email}</h1>
        <p className="text-sm text-text-muted">
          {ROLE_LABELS[member.role]}
          {!member.active && " · deactivated"} · view only
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="eyebrow text-text-faint">{terms.checkIns} today</p>
          <p className="font-display text-4xl font-light tabular-nums">{checkIns.length}</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow text-text-faint">Services today</p>
          <p className="font-display text-4xl font-light tabular-nums">{checkIns.filter((c) => c.service).length}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="eyebrow text-text-faint">{terms.checkIns} today</h2>
        {checkIns.length === 0 ? (
          <div className="card p-4 text-sm text-text-muted">No {terms.checkInsLower} yet today.</div>
        ) : (
          <ul className="card divide-y divide-border-subtle">
            {checkIns.map((c) => (
              <li key={c.id}>
                <Link href={`/team/client/${c.person_id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-bg-hover">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">{c.display_name}</p>
                    <p className="truncate text-xs text-text-muted">{c.service ?? c.reason ?? "No service noted"}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-text-faint">{time(c.checked_in_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="eyebrow text-text-faint">Services today</h2>
        {services.size === 0 ? (
          <div className="card p-4 text-sm text-text-muted">No services logged yet today.</div>
        ) : (
          <ul className="card divide-y divide-border-subtle">
            {[...services.entries()].map(([name, s]) => (
              <li key={name} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="text-text">{name}</span>
                <span className="tabular-nums text-text-muted">
                  ×{s.count}
                  {s.priced && <span className="ml-3 text-text">{formatMoney(s.cents)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="eyebrow text-text-faint">Calendar</h2>
        <MemberCalendar
          range={range}
          anchor={anchor}
          today={today}
          items={items}
          prevHref={monthHref(year, m - 1)}
          nextHref={monthHref(year, m + 1)}
        />
        <p className="text-xs text-text-faint">Their tasks and personal events show only as &quot;Busy&quot;.</p>
      </section>

      {viewer.role === "admin" && (
        <section className="space-y-2">
          <h2 className="eyebrow text-text-faint">Referrals they handled</h2>
          {referrals.length === 0 ? (
            <div className="card p-4 text-sm text-text-muted">None yet.</div>
          ) : (
            <ul className="card divide-y divide-border-subtle">
              {referrals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {r.appointment_at
                        ? `Appointment ${formatSlot(new Date(r.appointment_at), tz)}`
                        : r.handled_at
                          ? `Handled ${shortDate(r.handled_at, tz)}`
                          : ""}
                    </p>
                  </div>
                  <span className={`tag ${STATUS_TONE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
