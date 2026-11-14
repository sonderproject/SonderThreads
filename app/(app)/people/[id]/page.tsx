import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { listServices, serviceScope } from "@/lib/services";
import { getTerms } from "@/lib/terms-server";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { NO_BIRTH_YEAR } from "@/lib/parse-person-line";
import { getPerson } from "@/lib/actions/people";
import { getPersonTimeline } from "@/lib/actions/activity";
import { listTasksForPerson } from "@/lib/actions/tasks";
import { listLists, listListsForPerson } from "@/lib/actions/lists";
import { AddToListButton } from "@/components/people/AddToListButton";
import { DemographicSelect } from "@/components/people/DemographicSelect";
import { RefreshOnShow } from "@/components/ui/RefreshOnShow";
import { ETHNICITIES, GENDERS, INCOME_LEVELS } from "@/lib/demographics";
import { listNotesForPerson } from "@/lib/actions/notes";
import { listCheckInsForPerson, listCheckInReasons } from "@/lib/actions/check-ins";
import { PersonTimeline } from "@/components/people/PersonTimeline";
import { EditableField } from "@/components/people/EditableField";
import { DeletePersonButton } from "@/components/people/DeletePersonButton";
import { PersonNotes } from "@/components/people/PersonNotes";
import { CheckInForm } from "@/components/check-ins/CheckInForm";
import { CheckInRow } from "@/components/check-ins/CheckInRow";
import { TaskRow } from "@/components/tasks/TaskRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { isStale, STALE_DAYS } from "@/lib/stale";
import { isNew } from "@/lib/urgency";
import type { Activity } from "@/lib/types";
import { asUser } from "@/lib/db/as-user";
import { requireUserId } from "@/lib/current-user";
import { getTimeZone } from "@/lib/timezone";
import { shortDate } from "@/lib/team";
import { ClientComments, type ClientComment } from "@/components/org/ClientComments";
import { ShareToggle } from "@/components/people/ShareToggle";
import { getMembership } from "@/lib/org";
import { listOutcomes, listPersonOutcomes } from "@/lib/outcomes";
import { PersonOutcomes } from "@/components/people/PersonOutcomes";
import { dayKey } from "@/lib/tz";

/** Supervisor comments on one of my clients (read through the database's access rules). */
async function listCommentsForPerson(personId: string): Promise<ClientComment[]> {
  const userId = await requireUserId();
  return asUser(userId, (q) =>
    q<ClientComment>(
      `select c.id, c.body, c.created_at, coalesce(u.name, u.email) as author
         from client_comments c left join users u on u.id = c.author_id
        where c.person_id = $1 order by c.created_at desc`,
      [personId],
    ),
  ).catch(() => []);
}

/** node-postgres returns `date` columns as a local-midnight Date; the date input wants YYYY-MM-DD. */
function toDateString(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function formatBirthday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    // Saved without a year (e.g. "05/12" from a list) — don't show the placeholder one.
    year: y === NO_BIRTH_YEAR ? undefined : "numeric",
  });
}

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const terms = await getTerms();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const me = await requireUserId();
  // Everything loads at once (each query is scoped to the user, so a bad id just returns nothing).
  const [person, activity, tasks, lists, notes, checkIns, reasons, allLists, comments, tz, membership, services, scope, outcomes, recordedOutcomes] = await Promise.all([
    getPerson(id),
    getPersonTimeline(id),
    listTasksForPerson(id),
    listListsForPerson(id),
    listNotesForPerson(id),
    listCheckInsForPerson(id),
    listCheckInReasons(),
    listLists(),
    listCommentsForPerson(id),
    getTimeZone(),
    getMembership(),
    listServices(),
    serviceScope(),
    listOutcomes(),
    listPersonOutcomes(id),
  ]);
  if (!person) notFound();

  const openTasks = tasks.filter((t) => !t.completed);
  const birthday = toDateString(person.birthday as string | Date | null);

  return (
    <div className="space-y-8">
      <RefreshOnShow />
      <div>
        <div className="flex items-center gap-2">
          <h1>
            <EditableField
              personId={person.id}
              field="display_name"
              value={person.display_name}
              placeholder="Name"
              textClassName="page-title"
              required
            />
          </h1>
          {isNew(person.created_at) && <Badge tone="new">new</Badge>}
          {person.needs_followup && <Badge tone="attention">follow up</Badge>}
          {isStale(person) && (
            <span title={`No activity in ${STALE_DAYS}+ days`}>
              <Badge tone="attention">stale</Badge>
            </span>
          )}
          {/* Agency clients can only be deleted by the organization's admins (keeps its history and reports intact). */}
          {(!person.org_id || (membership?.active && membership.role === "admin")) && (
            <DeletePersonButton personId={person.id} name={person.display_name} />
          )}
        </div>
        <RegularStats checkIns={checkIns} visitWord={terms.checkInLower} visitsWord={terms.checkInsLower} formatDate={(iso) => shortDate(iso, tz)} />
        {membership?.active && person.user_id === me && (
          <div className="mt-2">
            <ShareToggle personId={person.id} shared={Boolean(person.org_id)} orgName={membership.orgName} />
          </div>
        )}
      </div>

      <Section title="Details">
        <div className="grid gap-2 sm:grid-cols-3">
          <Detail label="Birthday">
            <EditableField
              personId={person.id}
              field="birthday"
              value={birthday}
              placeholder="Add birthday..."
              textClassName="text-sm text-text"
              inputType="date"
              displayValue={birthday ? formatBirthday(birthday) : null}
            />
          </Detail>
          <Detail label="Phone">
            <EditableField
              personId={person.id}
              field="phone"
              value={person.phone}
              placeholder="Add phone..."
              textClassName="text-sm text-text"
              inputType="tel"
            />
          </Detail>
          <Detail label="Email">
            <EditableField
              personId={person.id}
              field="email"
              value={person.email}
              placeholder="Add email..."
              textClassName="break-all text-sm text-text"
              inputType="email"
            />
          </Detail>
          <Detail label="Gender">
            <DemographicSelect personId={person.id} key={`gender-${person.gender ?? ""}`}
              field="gender" value={person.gender} options={GENDERS} label="Gender" />
          </Detail>
          <Detail label="Ethnicity">
            <DemographicSelect
              personId={person.id}
              key={`ethnicity-${person.ethnicity ?? ""}`}
              field="ethnicity"
              value={person.ethnicity}
              options={ETHNICITIES}
              label="Ethnicity"
            />
          </Detail>
          <Detail label="Income level">
            <DemographicSelect
              personId={person.id}
              key={`income_level-${person.income_level ?? ""}`}
              field="income_level"
              value={person.income_level}
              options={INCOME_LEVELS}
              label="Income level"
            />
          </Detail>
        </div>
      </Section>

      <Section title="Summary">
        <p className="card px-3 py-2.5 text-sm text-text-muted">{person.summary ?? "No summary yet."}</p>
      </Section>

      <ClientComments personId={person.id} comments={comments} canComment={false} formatDate={(iso) => shortDate(iso, tz)} />

      <Section title="Notes">
        <PersonNotes personId={person.id} personName={person.display_name} notes={notes} />
      </Section>

      <Section title={`${terms.checkIns}${checkIns.length ? ` · ${checkIns.length}` : ""}`}>
        <div className="space-y-3">
          <CheckInForm personId={person.id} reasons={reasons} services={services} canAddService={scope.canManage} />
          <ServiceUsage checkIns={checkIns} formatDate={(iso) => shortDate(iso, tz)} />
          {checkIns.length === 0 ? (
            <EmptyState message={`No ${terms.checkInsLower} yet.`} />
          ) : (
            <div className="divide-y divide-border-subtle card">
              {checkIns.map((c) => (
                <CheckInRow key={c.id} checkIn={c} showPerson={false} showDay />
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title={`Outcomes${recordedOutcomes.length ? ` · ${recordedOutcomes.length}` : ""}`}>
        <PersonOutcomes
          personId={person.id}
          recorded={recordedOutcomes.map((o) => ({ ...o, dateLabel: shortDate(`${o.achievedOn}T12:00:00Z`, "UTC") }))}
          outcomes={outcomes}
          me={me}
          isAdmin={Boolean(membership?.active && membership.role === "admin")}
          today={dayKey(new Date(), tz)}
        />
      </Section>

      <Section title="Timeline">
        <PersonTimeline activity={activity as Activity[]} />
      </Section>

      <Section title="Tasks">
        {openTasks.length === 0 ? (
          <EmptyState message="No open tasks." />
        ) : (
          <div className="divide-y divide-border-subtle card">
            {openTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Lists">
        <div className="flex flex-wrap items-start gap-2">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              className="rounded-full border border-border px-2.5 py-1 text-sm text-text hover:border-accent hover:text-accent"
            >
              {list.name}
            </Link>
          ))}
          <AddToListButton
            personId={person.id}
            lists={allLists.map((l) => ({ id: l.id, name: l.name, is_group: l.is_group }))}
            memberOf={lists.map((l) => l.id)}
          />
        </div>
      </Section>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card px-3 py-2">
      <p className="mb-0.5 tabular-nums text-[11px] uppercase text-text-faint">{label}</p>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="section-label mb-3">{title}</h2>
      {children}
    </section>
  );
}

/** "Haircut · 4× · last Nov 3 · $180" for each service this person has had. */
function ServiceUsage({
  checkIns,
  formatDate,
}: {
  checkIns: { service_id?: string | null; reason: string | null; checked_in_at: string; amount_cents?: number | null }[];
  formatDate: (iso: string) => string;
}) {
  const byService = new Map<string, { name: string; count: number; last: string; total: number }>();
  for (const c of checkIns) {
    if (!c.service_id) continue;
    const s = byService.get(c.service_id) ?? { name: c.reason ?? "Service", count: 0, last: c.checked_in_at, total: 0 };
    s.count += 1;
    if (c.checked_in_at > s.last) s.last = c.checked_in_at;
    s.total += c.amount_cents ?? 0;
    byService.set(c.service_id, s);
  }
  const rows = [...byService.values()].sort((a, b) => b.count - a.count);
  if (!rows.length) return null;
  return (
    <div className="card space-y-1.5 px-3.5 py-3">
      <p className="eyebrow">Services</p>
      <ul className="space-y-1 text-sm">
        {rows.map((s) => (
          <li key={s.name} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-text">{s.name}</span>
            <span className="tabular-nums text-[0.82rem] text-text-muted">
              {s.count}× · last {formatDate(s.last)}
              {s.total > 0 ? ` · ${formatMoney(s.total)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A regular at a glance, from the visits already on this page:
 * "Regular since Mar 2026 · 14 visits · $820 spent · usually every 6 weeks · last visit 23 days ago".
 * Spending shows only when visits have amounts; the usual rhythm needs 3+ visits.
 */
function RegularStats({
  checkIns,
  visitWord,
  visitsWord,
  formatDate,
}: {
  checkIns: { checked_in_at: string; amount_cents?: number | null }[];
  visitWord: string;
  visitsWord: string;
  formatDate: (iso: string) => string;
}) {
  if (checkIns.length === 0) return null;
  const times = checkIns.map((c) => Date.parse(c.checked_in_at)).sort((a, b) => a - b);
  const first = times[0];
  const last = times[times.length - 1];
  const spent = checkIns.reduce((n, c) => n + (c.amount_cents ?? 0), 0);
  const DAY = 86_400_000;
  // Usual gap between visits on different days (median, so one long break doesn't skew it).
  const days = [...new Set(times.map((t) => Math.floor(t / DAY)))];
  const gaps = days.slice(1).map((d, i) => d - days[i]).sort((a, b) => a - b);
  const median = gaps.length >= 2 ? gaps[Math.floor(gaps.length / 2)] : null;
  const rhythm =
    median === null ? null : median <= 1 ? "most days" : median < 10 ? `every ${median} days` : median < 60 ? `every ${Math.round(median / 7)} weeks` : `every ${Math.round(median / 30)} months`;
  const ago = Math.floor((Date.now() - last) / DAY);
  const agoText = ago <= 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`;
  const since = new Date(first).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const parts = [
    checkIns.length > 1 ? `Since ${since}` : null,
    `${checkIns.length} ${checkIns.length === 1 ? visitWord : visitsWord}`,
    spent > 0 ? `${formatMoney(spent)} spent` : null,
    rhythm ? `usually ${rhythm}` : null,
    `last ${agoText}`,
  ].filter(Boolean);
  return (
    <p className="mt-1.5 text-sm tabular-nums text-text-muted" title={`First ${visitWord} ${formatDate(new Date(first).toISOString())}`}>
      {parts.join(" · ")}
    </p>
  );
}
