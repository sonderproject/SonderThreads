import { query } from "@/lib/db/client";
import { asUser, type UserQuery } from "@/lib/db/as-user";
import { ETHNICITIES, GENDERS, INCOME_LEVELS, NOT_RECORDED } from "@/lib/demographics";

/**
 * Metrics for the Impact page and its exports. Plain server module (not
 * "use server"): callers pass a trusted user id (from requireUserId()). All
 * days are calendar days in the viewer's time zone; ranges are inclusive
 * "YYYY-MM-DD".
 *
 * Scope "me" counts the user's own records. Scope "org" counts the
 * organization's client records and runs as the user through asUser(), so the
 * database's access rules decide what's included: never anyone's personal
 * records (they have no org_id), never another organization's.
 */

import {
  addDays,
  bucketFor,
  daysBetween,
  toUtc,
  type Bucket,
  type Kpis,
  type Metrics,
  type Point,
  type FollowThrough,
  type MetricsScope,
  type ReachPoint,
} from "@/lib/metrics-shared";

export type { Bucket, Kpis, Metrics, Point };
export { normalizeRange } from "@/lib/metrics-shared";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAX_REASONS = 8;

/** Start of the bucket containing `day` (weeks start Monday, like Postgres date_trunc). */
function bucketStart(day: string, bucket: Bucket): string {
  if (bucket === "day") return day;
  if (bucket === "month") return `${day.slice(0, 7)}-01`;
  const dow = (new Date(toUtc(day)).getUTCDay() + 6) % 7; // Mon = 0
  return addDays(day, -dow);
}

function bucketLabel(key: string, bucket: Bucket): string {
  const [y, m, d] = key.split("-").map(Number);
  if (bucket === "month") return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}`;
}

/** Every bucket from `from` to `to`, so quiet days still show as zero. */
function bucketKeys(from: string, to: string, bucket: Bucket): string[] {
  const keys: string[] = [];
  let k = bucketStart(from, bucket);
  while (k <= to) {
    keys.push(k);
    if (bucket === "day") k = addDays(k, 1);
    else if (bucket === "week") k = addDays(k, 7);
    else {
      const [y, m] = k.split("-").map(Number);
      k = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }
  }
  return keys;
}

/**
 * When someone became a client, for "new clients" counts: their "client since"
 * date if known, else the day they were added. Clients brought in by a
 * spreadsheet import with no "client since" date have none (null): they were
 * existing clients, so they never count as new. $2 is the time zone.
 */
const INTAKE_DATE = `coalesce(client_since, case when import_batch is null then (created_at at time zone $2)::date end)`;
const INTAKE_DATE_P = `coalesce(p.client_since, case when p.import_batch is null then (p.created_at at time zone $2)::date end)`;

type Run = <T>(text: string, params?: unknown[]) => Promise<T[]>;
/** The column that scopes a query: the owner for "me", the organization for "org". */
type Col = "user_id" | "org_id";

async function kpisFor(run: Run, col: Col, scopeId: string, tz: string, from: string, to: string): Promise<Kpis> {
  const [row] = await run<Record<keyof Kpis, number>>(
    `select
       (select count(*) from check_ins c join people p on p.id = c.person_id
         where c.${col} = $1 and c.deleted_at is null
           and (c.checked_in_at at time zone $2)::date between $3::date and $4::date)::int as "checkIns",
       (select count(distinct c.person_id) from check_ins c join people p on p.id = c.person_id
         where c.${col} = $1 and c.deleted_at is null
           and (c.checked_in_at at time zone $2)::date between $3::date and $4::date)::int as "peopleServed",
       (select count(*) from people where ${col} = $1
           and ${INTAKE_DATE} between $3::date and $4::date)::int as "newPeople",
       (select count(*) from notes where ${col} = $1 and deleted_at is null
           and (created_at at time zone $2)::date between $3::date and $4::date)::int as "notes",
       (select count(*) from tasks where ${col} = $1 and deleted_at is null and completed and completed_at is not null
           and (completed_at at time zone $2)::date between $3::date and $4::date)::int as "tasksDone"`,
    [scopeId, tz, from, to],
  );
  return row;
}

export async function computeMetrics(
  userId: string,
  tz: string,
  from: string,
  to: string,
  org: { id: string; name: string } | null = null,
): Promise<Metrics> {
  if (org) return asUser(userId, (q: UserQuery) => compute(q as Run, "org_id", org.id, tz, from, to, "org", org.name));
  return compute(query as Run, "user_id", userId, tz, from, to, "me", null);
}

async function compute(
  run: Run,
  col: Col,
  scopeId: string,
  tz: string,
  from: string,
  to: string,
  scope: MetricsScope,
  orgName: string | null,
): Promise<Metrics> {
  const length = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(length - 1));
  const bucket = bucketFor(from, to);
  const range = [scopeId, tz, from, to];
  // Clients deleted later still count in the periods they were served, so past reports never change.
  const inRange = `${col} = $1`;

  const [sinceRows, kpis, prev, checkInRows, newPeopleRows, reasonRows, weekdayRows, visitorRows, demoRows, reachRows, heatRows, followRows] = await Promise.all([
    run<{ d: string | null }>(
      `select to_char(min(c.checked_in_at at time zone $2), 'YYYY-MM-DD') as d from check_ins c where c.${col} = $1 and c.deleted_at is null`,
      [scopeId, tz],
    ),
    kpisFor(run, col, scopeId, tz, from, to),
    kpisFor(run, col, scopeId, tz, prevFrom, prevTo),
    run<{ k: string; n: number }>(
      `select to_char(date_trunc($5, c.checked_in_at at time zone $2), 'YYYY-MM-DD') as k, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id
        where c.${col} = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by 1`,
      [...range, bucket],
    ),
    run<{ k: string; n: number }>(
      `select to_char(date_trunc($5, ${INTAKE_DATE}), 'YYYY-MM-DD') as k, count(*)::int as n
         from people where ${inRange} and ${INTAKE_DATE} between $3::date and $4::date
        group by 1`,
      [...range, bucket],
    ),
    run<{ label: string; n: number }>(
      `select coalesce(min(nullif(trim(c.reason), '')), 'No reason given') as label, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id
        where c.${col} = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by lower(coalesce(nullif(trim(c.reason), ''), ''))
        order by n desc, label`,
      range,
    ),
    run<{ d: number; n: number }>(
      `select extract(isodow from c.checked_in_at at time zone $2)::int as d, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id
        where c.${col} = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by 1`,
      range,
    ),
    run<{ id: string; label: string; n: number }>(
      `select p.id, p.display_name as label, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
        where c.${col} = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by p.id, p.display_name
        order by n desc, p.display_name
        limit 10`,
      range,
    ),
    run<{ ethnicity: string | null; income_level: string | null; gender: string | null }>(
      `select p.ethnicity, p.income_level, p.gender
         from people p
        where p.${col} = $1
          and exists (select 1 from check_ins c
                       where c.person_id = p.id and c.${col} = $1 and c.deleted_at is null
                         and (c.checked_in_at at time zone $2)::date between $3::date and $4::date)`,
      range,
    ),
    // Each person served per bucket, and whether it was a first visit: their first check-in ever, by someone
    // added during this range (clients added earlier, or with an earlier "client since" date, aren't new).
    run<{ k: string; first: number; returning: number }>(
      `with firsts as (
         select c.person_id, min(c.checked_in_at) as f from check_ins c
          where c.${col} = $1 and c.deleted_at is null group by c.person_id)
       select k, count(*) filter (where is_first)::int as first, count(*) filter (where not is_first)::int as returning
         from (
           select distinct to_char(date_trunc($5, c.checked_in_at at time zone $2), 'YYYY-MM-DD') as k, c.person_id,
                  date_trunc($5, f.f at time zone $2) = date_trunc($5, c.checked_in_at at time zone $2)
                    and coalesce(${INTAKE_DATE_P} >= $3::date, false) as is_first
             from check_ins c join people p on p.id = c.person_id
             join firsts f on f.person_id = c.person_id
            where c.${col} = $1 and c.deleted_at is null
              and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
         ) x group by k`,
      [...range, bucket],
    ),
    run<{ d: number; b: number; n: number }>(
      `select extract(isodow from c.checked_in_at at time zone $2)::int as d,
              (extract(hour from c.checked_in_at at time zone $2)::int / 2) as b, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id
        where c.${col} = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by 1, 2`,
      range,
    ),
    run<FollowThrough>(
      `select count(*)::int as due,
              count(*) filter (where completed and (completed_at at time zone $2)::date <= (due_at at time zone $2)::date)::int as "onTime",
              count(*) filter (where completed and (completed_at at time zone $2)::date > (due_at at time zone $2)::date)::int as late,
              count(*) filter (where not completed)::int as open
         from tasks
        where ${col} = $1 and deleted_at is null and due_at is not null
          and (due_at at time zone $2)::date between $3::date and $4::date`,
      range,
    ),
  ]);

  // Every category in the standard order (zeros included) so exports are complete tables.
  const tally = (values: (string | null)[], categories: readonly string[]): Point[] => {
    const counts = new Map<string, number>();
    for (const v of values) {
      const k = v && categories.includes(v) ? v : NOT_RECORDED;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...categories, NOT_RECORDED].map((c) => ({ key: c, label: c, value: counts.get(c) ?? 0 }));
  };

  const series = (rows: { k: string; n: number }[]): Point[] => {
    const byKey = new Map(rows.map((r) => [r.k, r.n]));
    return bucketKeys(from, to, bucket).map((key) => ({ key, label: bucketLabel(key, bucket), value: byKey.get(key) ?? 0 }));
  };

  // Top reasons, the rest folded into "Other" so the chart stays readable.
  const reasons: Point[] = reasonRows.slice(0, MAX_REASONS).map((r) => ({ key: r.label, label: r.label, value: r.n }));
  const rest = reasonRows.slice(MAX_REASONS).reduce((s, r) => s + r.n, 0);
  if (rest > 0) reasons.push({ key: "__other", label: "Other", value: rest });

  const byDow = new Map(weekdayRows.map((r) => [r.d, r.n]));

  const reach = (rows: { k: string; first: number; returning: number }[]): ReachPoint[] => {
    const byKey = new Map(rows.map((r) => [r.k, r]));
    return bucketKeys(from, to, bucket).map((key) => ({
      key,
      label: bucketLabel(key, bucket),
      first: byKey.get(key)?.first ?? 0,
      returning: byKey.get(key)?.returning ?? 0,
    }));
  };
  const heatmap = Array.from({ length: 7 }, () => Array(12).fill(0) as number[]);
  for (const r of heatRows) heatmap[r.d - 1][r.b] = r.n;

  return {
    from,
    to,
    prevFrom,
    prevTo,
    bucket,
    kpis,
    prev,
    checkInsOverTime: series(checkInRows),
    newPeopleOverTime: series(newPeopleRows),
    byReason: reasons,
    byWeekday: WEEKDAYS.map((label, i) => ({ key: String(i + 1), label, value: byDow.get(i + 1) ?? 0 })),
    topVisitors: visitorRows.map((r) => ({ key: r.id, personId: r.id, label: r.label, value: r.n })),
    byEthnicity: tally(demoRows.map((r) => r.ethnicity), ETHNICITIES),
    byIncome: tally(demoRows.map((r) => r.income_level), INCOME_LEVELS),
    byGender: tally(demoRows.map((r) => r.gender), GENDERS),
    scope,
    orgName,
    reach: reach(reachRows),
    heatmap,
    followThrough: followRows[0] ?? { due: 0, onTime: 0, late: 0, open: 0 },
    trackingSince: sinceRows[0]?.d ?? null,
  };
}

