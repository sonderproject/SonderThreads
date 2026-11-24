/**
 * Dashboards and scheduled reports: tile definitions, layout cleaning and the period
 * math for schedules. No database or server imports (shared by the browser, the cron
 * job and the tests). Reports contain counts only: never names, notes or free text.
 */

export type TileKey =
  | "people_served"
  | "visits"
  | "new_people"
  | "exits"
  | "form_responses"
  | "automation_runs"
  | "revenue"
  | "top_services"
  | "gender";

export type Audience = "individual" | "business" | "nonprofit";

export const TILES: { key: TileKey; label: (t: { checkIns: string }) => string; hint: string; only?: Audience[] }[] = [
  { key: "people_served", label: () => "People served", hint: "Different people with at least one visit." },
  { key: "visits", label: (t) => t.checkIns, hint: "Every visit logged." },
  { key: "new_people", label: () => "New people", hint: "Added in the period (imports included)." },
  { key: "exits", label: () => "Exits", hint: "Split into positive, neutral and unplanned." },
  { key: "form_responses", label: () => "Form responses", hint: "With the completion rate (responses ÷ views)." },
  { key: "automation_runs", label: () => "Automation runs", hint: "Times your automations did something." },
  { key: "revenue", label: () => "Revenue", hint: "From priced services on visits.", only: ["business", "individual"] },
  { key: "top_services", label: () => "Top services", hint: "Most used services in the period." },
  { key: "gender", label: () => "Gender of people served", hint: "Each person once.", only: ["nonprofit"] },
];

export const DEFAULT_TILES: Record<Audience, TileKey[]> = {
  nonprofit: ["people_served", "visits", "new_people", "exits", "form_responses", "top_services", "gender"],
  business: ["people_served", "visits", "revenue", "new_people", "exits", "form_responses", "top_services"],
  individual: ["people_served", "visits", "new_people", "revenue", "form_responses", "automation_runs"],
};

export function tilesFor(audience: Audience) {
  return TILES.filter((t) => !t.only || t.only.includes(audience));
}

/** Known, allowed tiles only, no repeats, at most all of them. */
export function cleanTiles(raw: unknown, audience: Audience): TileKey[] {
  const allowed = new Set(tilesFor(audience).map((t) => t.key));
  const list = Array.isArray(raw) ? raw : [];
  const out: TileKey[] = [];
  for (const k of list) if (typeof k === "string" && allowed.has(k as TileKey) && !out.includes(k as TileKey)) out.push(k as TileKey);
  return out.length ? out : DEFAULT_TILES[audience];
}

/* ------------------------------------------------------------------ */
/* Date ranges                                                         */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const toUtc = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * DAY);

export type RangeKey = "7d" | "30d" | "90d" | "this_month" | "last_month" | "this_year" | "custom";
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },
  { key: "custom", label: "Custom" },
];

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toUtc(v));

/** A range from a preset (or custom dates), ending no later than today. At most 2 years long. */
export function rangeFor(key: string | undefined, today: string, from?: string, to?: string): { key: RangeKey; from: string; to: string } {
  switch (key) {
    case "7d":
      return { key, from: addDays(today, -6), to: today };
    case "90d":
      return { key, from: addDays(today, -89), to: today };
    case "this_month":
      return { key, from: `${today.slice(0, 7)}-01`, to: today };
    case "last_month": {
      const first = `${today.slice(0, 7)}-01`;
      const end = addDays(first, -1);
      return { key, from: `${end.slice(0, 7)}-01`, to: end };
    }
    case "this_year":
      return { key, from: `${today.slice(0, 4)}-01-01`, to: today };
    case "custom":
      if (isDay(from) && isDay(to)) {
        let a = from <= to ? from : to;
        let b = from <= to ? to : from;
        if (b > today) b = today;
        if (a > b) a = b;
        if (toUtc(b) - toUtc(a) > 731 * DAY) a = addDays(b, -730);
        return { key, from: a, to: b };
      }
      return { key: "30d", from: addDays(today, -29), to: today };
    default:
      return { key: "30d", from: addDays(today, -29), to: today };
  }
}

/** The same-length period right before. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const len = Math.round((toUtc(to) - toUtc(from)) / DAY) + 1;
  const prevTo = addDays(from, -1);
  return { from: addDays(prevTo, -(len - 1)), to: prevTo };
}

/** Change in percent, or null when there's nothing to compare with. */
export function change(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return Math.round(((now - before) / before) * 100);
}

/* ------------------------------------------------------------------ */
/* Scheduled reports                                                   */
/* ------------------------------------------------------------------ */

export type Frequency = "weekly" | "monthly";
export type Recipients = "me" | "managers";
export type ScheduleInput = { name: string; frequency: Frequency; weekday: number; monthDay: number; hour: number; recipients: Recipients; attachPdf: boolean; tiles: TileKey[] };

export const REPORT_LIMITS = { schedulesPerAccount: 10, emailsPerDay: 50, nameLength: 80 } as const;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function cleanSchedule(raw: Record<string, unknown>, audience: Audience, isOrg: boolean): ScheduleInput {
  const name = typeof raw.name === "string" ? raw.name.replace(/\s+/g, " ").trim().slice(0, REPORT_LIMITS.nameLength) : "";
  const frequency: Frequency = raw.frequency === "monthly" ? "monthly" : "weekly";
  const n = (v: unknown, min: number, max: number, d: number) => {
    const x = Number(v);
    return Number.isInteger(x) && x >= min && x <= max ? x : d;
  };
  return {
    name: name || (frequency === "weekly" ? "Weekly report" : "Monthly report"),
    frequency,
    weekday: n(raw.weekday, 0, 6, 1),
    monthDay: n(raw.monthDay, 1, 28, 1),
    hour: n(raw.hour, 0, 23, 8),
    // Only people inside the account: the schedule's owner, or the organization's Admins and Managers.
    recipients: isOrg && raw.recipients === "managers" ? "managers" : "me",
    attachPdf: isOrg && (raw.attachPdf === true || raw.attachPdf === "1" || raw.attachPdf === "on"),
    tiles: cleanTiles(raw.tiles, audience),
  };
}

/**
 * Which period is due at `now` (local date and hour in the schedule's zone), if any:
 * weekly reports cover the 7 days ending yesterday, monthly ones the previous month.
 * `period` is the key that makes each send happen once.
 */
export function duePeriod(
  s: Pick<ScheduleInput, "frequency" | "weekday" | "monthDay" | "hour">,
  local: { day: string; weekday: number; hour: number },
): { period: string; from: string; to: string } | null {
  if (local.hour < s.hour) return null;
  if (s.frequency === "weekly") {
    if (local.weekday !== s.weekday) return null;
    return { period: `w:${local.day}`, from: addDays(local.day, -7), to: addDays(local.day, -1) };
  }
  if (Number(local.day.slice(8, 10)) !== s.monthDay) return null;
  const first = `${local.day.slice(0, 7)}-01`;
  const end = addDays(first, -1);
  return { period: `m:${end.slice(0, 7)}`, from: `${end.slice(0, 7)}-01`, to: end };
}

/** "Nov 16 – 22, 2026" style label. */
export function rangeLabel(from: string, to: string): string {
  const f = new Date(toUtc(from));
  const t = new Date(toUtc(to));
  const md = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const y = t.getUTCFullYear();
  if (from === to) return `${md(t)}, ${y}`;
  if (f.getUTCFullYear() !== y) return `${md(f)}, ${f.getUTCFullYear()} – ${md(t)}, ${y}`;
  if (f.getUTCMonth() === t.getUTCMonth()) return `${md(f)} – ${t.getUTCDate()}, ${y}`;
  return `${md(f)} – ${md(t)}, ${y}`;
}
