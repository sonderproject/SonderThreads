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

/** People served in one bucket, split by whether it was their first visit ever. */
export type ReachPoint = { key: string; label: string; first: number; returning: number };

/** Tasks that were due in the period, and how they turned out. */
export type FollowThrough = { due: number; onTime: number; late: number; open: number };

/** Whose numbers: your own, or your whole organization (admins and supervisors). */
export type MetricsScope = "me" | "org";

/** One service's numbers for the period (Settings → Services). */
/** One outcome in the period: how many people reached it (each person once), and in the previous period. */
export type OutcomeStat = { name: string; people: number; prevPeople: number };

export type ServiceStat = {
  name: string;
  /** Times provided in the period, and in the previous period of the same length. */
  count: number;
  prevCount: number;
  /** Different people it was provided to. */
  people: number;
  /** Total amount recorded, in cents (0 when no prices are used). */
  valueCents: number;
  /** Most common weekday (Monday..Sunday) and 2-hour block ("2p"), or null. */
  busiestDay: string | null;
  busiestTime: string | null;
};

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
  byGender: Point[];
  scope: MetricsScope;
  /** Organization name when scope is "org". */
  orgName: string | null;
  reach: ReachPoint[];
  /** Check-ins by weekday (rows, Mon..Sun) and 2-hour block of the day (12 columns, from midnight). */
  heatmap: number[][];
  followThrough: FollowThrough;
  /** Date of the first check-in ever recorded (YYYY-MM-DD), or null if none. */
  trackingSince: string | null;
  /** Services provided in the period, most used first (empty when none are logged). */
  services: ServiceStat[];
  /** Outcomes reached in the period, most reached first (empty when none were recorded). */
  outcomes: OutcomeStat[];
  /** Different people who reached at least one outcome in the period, and in the previous period. */
  outcomePeople: number;
  prevOutcomePeople: number;
};

export const HEATMAP_BLOCKS = ["12a", "2a", "4a", "6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p"];
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortDay = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3)} ${Number(day.slice(8, 10))}`;

/** The period in words: "in November" for a whole calendar month, otherwise the exact dates. */
function periodWord(m: Metrics): string {
  if (m.from.endsWith("-01") && m.from.slice(0, 7) === m.to.slice(0, 7) && addDays(m.to, 1).endsWith("-01"))
    return `in ${MONTHS[Number(m.from.slice(5, 7)) - 1]}`;
  return `from ${shortDay(m.from)} to ${shortDay(m.to)}`;
}

function changePhrase(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? "" : "";
  const c = Math.round(((cur - prev) / prev) * 100);
  if (Math.abs(c) < 3) return ", about the same as the period before";
  return `, ${c > 0 ? "up" : "down"} ${Math.abs(c)}% from the period before`;
}

/**
 * The written summary at the top of the Impact page and the PDF: a few plain
 * sentences built from the numbers, so the report tells its own story.
 * Follow-ups are optional (tracking them is extra work), so they're only
 * mentioned when the viewer turns them on.
 */
/** Report words: nonprofits serve people across check-ins; businesses and individuals see customers or clients across visits or meetings. */
export function storyWords(audience: "individual" | "nonprofit" | "business" = "nonprofit") {
  if (audience === "business")
    return { verb: "saw", one: "customer", many: "customers", events: "visits", newOne: "a new customer", newMany: "new customers", need: "The most popular service was" };
  if (audience === "individual")
    return { verb: "met with", one: "client", many: "clients", events: "meetings", newOne: "a new client", newMany: "new clients", need: "The most common reason was" };
  return { verb: "served", one: "person", many: "people", events: "check-ins", newOne: "a new client", newMany: "new clients", need: "The most common need was" };
}

export function buildStory(m: Metrics, opts: { followUps?: boolean; audience?: "individual" | "nonprofit" | "business" } = {}): string[] {
  const who = m.scope === "org" ? (m.orgName ?? "Your organization") : "You";
  const w = storyWords(opts.audience);
  const out: string[] = [];
  const k = m.kpis;
  if (k.peopleServed === 0) {
    out.push(`${who} didn't record any ${w.events} ${periodWord(m)}.`);
  } else {
    out.push(
      `${who} ${w.verb} ${k.peopleServed.toLocaleString()} ${k.peopleServed === 1 ? w.one : w.many} across ${k.checkIns.toLocaleString()} ${w.events} ${periodWord(m)}${changePhrase(k.peopleServed, m.prev.peopleServed)}.`,
    );
    const firsts = m.reach.reduce((s, r) => s + r.first, 0);
    if (firsts > 0) out.push(`${firsts.toLocaleString()} of them ${firsts === 1 ? `was ${w.newOne}` : `were ${w.newMany}`} on their first visit.`);
    if (m.trackingSince && m.trackingSince > m.from)
      out.push(`Strynd started recording on ${shortDay(m.trackingSince)}, so visits before then aren't counted.`);
    const visits = k.checkIns / k.peopleServed;
    if (visits >= 1.5) out.push(`On average, each ${w.one} visited ${visits.toFixed(1)} times.`);
  }
  const reasons = m.byReason.filter((r) => r.key !== "__other" && r.label !== "No reason given");
  const total = m.byReason.reduce((s, r) => s + r.value, 0);
  if (reasons.length) out.push(`${w.need} ${reasons[0].label.toLowerCase()} (${pct(reasons[0].value, total)}% of ${w.events}).`);
  // Outcomes: results, not just activity ("41 people reached an outcome in November. Most often: got a job (18).").
  if (m.outcomePeople > 0) {
    const top = m.outcomes[0];
    out.push(
      `${m.outcomePeople.toLocaleString()} ${m.outcomePeople === 1 ? w.one : w.many} reached an outcome ${periodWord(m)}${changePhrase(m.outcomePeople, m.prevOutcomePeople)}.` +
        (top && top.people > 0 ? ` Most often: ${top.name.toLowerCase()} (${top.people.toLocaleString()}).` : ""),
    );
  }
  const revenue = m.services.reduce((n, s) => n + s.valueCents, 0);
  if (opts.audience === "business" && revenue > 0 && k.checkIns > 0)
    out.push(`Services brought in $${Math.round(revenue / 100).toLocaleString()}, about $${Math.round(revenue / 100 / k.checkIns)} per visit.`);
  let best = { d: -1, b: -1, n: 0 };
  m.heatmap.forEach((row, d) => row.forEach((n, b) => n > best.n && (best = { d, b, n })));
  if (best.n >= 3) out.push(`The busiest time was ${WEEKDAY_NAMES[best.d]}s around ${HEATMAP_BLOCKS[best.b]}m.`);
  const f = m.followThrough;
  const done = f.onTime + f.late;
  if (opts.followUps && done > 0) out.push(`${done.toLocaleString()} of the ${f.due.toLocaleString()} follow-ups due were done.`);
  return out;
}

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
