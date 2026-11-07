import { query } from "@/lib/db/client";
import { ETHNICITIES, INCOME_LEVELS, NOT_RECORDED } from "@/lib/demographics";

/**
 * Metrics for the Command page and its exports. Plain server module (not
 * "use server"): callers pass a trusted user id. All days are calendar days
 * in the viewer's time zone; ranges are inclusive "YYYY-MM-DD".
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

async function kpisFor(userId: string, tz: string, from: string, to: string): Promise<Kpis> {
  const [row] = await query<Record<keyof Kpis, number>>(
    `select
       (select count(*) from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
         where c.user_id = $1 and c.deleted_at is null
           and (c.checked_in_at at time zone $2)::date between $3::date and $4::date)::int as "checkIns",
       (select count(distinct c.person_id) from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
         where c.user_id = $1 and c.deleted_at is null
           and (c.checked_in_at at time zone $2)::date between $3::date and $4::date)::int as "peopleServed",
       (select count(*) from people where user_id = $1 and deleted_at is null
           and (created_at at time zone $2)::date between $3::date and $4::date)::int as "newPeople",
       (select count(*) from notes where user_id = $1 and deleted_at is null
           and (created_at at time zone $2)::date between $3::date and $4::date)::int as "notes",
       (select count(*) from tasks where user_id = $1 and deleted_at is null and completed and completed_at is not null
           and (completed_at at time zone $2)::date between $3::date and $4::date)::int as "tasksDone"`,
    [userId, tz, from, to],
  );
  return row;
}

export async function computeMetrics(userId: string, tz: string, from: string, to: string): Promise<Metrics> {
  const length = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(length - 1));
  const bucket = bucketFor(from, to);
  const range = [userId, tz, from, to];
  const inRange = `user_id = $1 and deleted_at is null`;

  const [kpis, prev, checkInRows, newPeopleRows, reasonRows, weekdayRows, visitorRows, demoRows] = await Promise.all([
    kpisFor(userId, tz, from, to),
    kpisFor(userId, tz, prevFrom, prevTo),
    query<{ k: string; n: number }>(
      `select to_char(date_trunc($5, c.checked_in_at at time zone $2), 'YYYY-MM-DD') as k, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
        where c.user_id = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by 1`,
      [...range, bucket],
    ),
    query<{ k: string; n: number }>(
      `select to_char(date_trunc($5, created_at at time zone $2), 'YYYY-MM-DD') as k, count(*)::int as n
         from people where ${inRange} and (created_at at time zone $2)::date between $3::date and $4::date
        group by 1`,
      [...range, bucket],
    ),
    query<{ label: string; n: number }>(
      `select coalesce(min(nullif(trim(c.reason), '')), 'No reason given') as label, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
        where c.user_id = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by lower(coalesce(nullif(trim(c.reason), ''), ''))
        order by n desc, label`,
      range,
    ),
    query<{ d: number; n: number }>(
      `select extract(isodow from c.checked_in_at at time zone $2)::int as d, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
        where c.user_id = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by 1`,
      range,
    ),
    query<{ id: string; label: string; n: number }>(
      `select p.id, p.display_name as label, count(*)::int as n
         from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
        where c.user_id = $1 and c.deleted_at is null
          and (c.checked_in_at at time zone $2)::date between $3::date and $4::date
        group by p.id, p.display_name
        order by n desc, p.display_name
        limit 10`,
      range,
    ),
    query<{ ethnicity: string | null; income_level: string | null }>(
      `select p.ethnicity, p.income_level
         from people p
        where p.user_id = $1 and p.deleted_at is null
          and exists (select 1 from check_ins c
                       where c.person_id = p.id and c.user_id = $1 and c.deleted_at is null
                         and (c.checked_in_at at time zone $2)::date between $3::date and $4::date)`,
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
  };
}

