/**
 * Metrics types and date-range helpers with no database access, safe to
 * import from client components (lib/metrics.ts does the queries).
 */

export type Bucket = "day" | "week" | "month";

export type Kpis = {
  checkIns: number;
  peopleServed: number; // unduplicated: each person counted once
  newPeople: number;
  notes: number;
  tasksDone: number;
};

export type Point = { key: string; label: string; value: number };

export type Metrics = {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  bucket: Bucket;
  kpis: Kpis;
  prev: Kpis;
  checkInsOverTime: Point[];
  newPeopleOverTime: Point[];
  byReason: Point[];
  byWeekday: Point[];
  topVisitors: (Point & { personId: string })[];
  /** Demographics of the people served in the period (each person once). */
  byEthnicity: Point[];
  byIncome: Point[];
};

const DAY_MS = 86_400_000;

export const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => fromUtc(toUtc(day) + n * DAY_MS);
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;

export function bucketFor(from: string, to: string): Bucket {
  const n = daysBetween(from, to);
  return n <= 31 ? "day" : n <= 183 ? "week" : "month";
}

/** Clamp a requested range to something sane (max ~5 years, from <= to). */
export function normalizeRange(from: string | null | undefined, to: string | null | undefined, today: string) {
  const valid = (d: string | null | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(toUtc(d));
  let t = valid(to) ? to : today;
  let f = valid(from) ? from : addDays(t, -29);
  if (f > t) [f, t] = [t, f];
  if (daysBetween(f, t) > 1830) f = addDays(t, -1829);
  return { from: f, to: t };
}
