/**
 * Calendar data shared by the server (which gathers it) and the browser
 * (which draws it). Days are "YYYY-MM-DD" keys in the viewer's time zone.
 */

export type CalendarView = "month" | "week" | "agenda";
export const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "agenda"];

export type CalendarItemKind = "meeting" | "task" | "birthday" | "external";

export type CalendarItem = {
  /** Unique within the page (kind-prefixed). */
  key: string;
  kind: CalendarItemKind;
  title: string;
  /** Local day it falls on. */
  day: string;
  /** Minutes after local midnight, or null for all-day items. */
  minutes: number | null;
  /** End, in minutes after the start day's midnight (external events only). */
  endMinutes?: number | null;
  href?: string;
  /** Tasks only. */
  taskId?: string;
  completed?: boolean;
  /** Outside calendars only: the calendar's name and palette slot (1-4). */
  source?: string;
  color?: number;
  /** Meeting reason or event location. */
  detail?: string | null;
};

export type CalendarFeedStatus = { id: string; name: string; color: number; error: string | null };

/** Days in a view, inclusive range, plus the label the toolbar shows. */
export type ViewRange = { from: string; to: string; label: string };

export const AGENDA_DAYS = 30;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3));

export function isDayKey(s: string | undefined | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && y <= 2200 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function parseKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

export function makeKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Calendar arithmetic on day keys (no time zones involved). */
export function addDays(key: string, n: number): string {
  const { year, month, day } = parseKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return makeKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addMonths(key: string, n: number): string {
  const { year, month, day } = parseKey(key);
  const first = new Date(Date.UTC(year, month - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return makeKey(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(day, last));
}

/** 0 = Sunday. */
export function weekday(key: string): number {
  const { year, month, day } = parseKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** The days a view shows around `anchor`. Month and week views start on Sunday. */
export function viewRange(view: CalendarView, anchor: string): ViewRange {
  const { year, month } = parseKey(anchor);
  if (view === "month") {
    const first = makeKey(year, month, 1);
    const last = addDays(addMonths(first, 1), -1);
    return {
      from: addDays(first, -weekday(first)),
      to: addDays(last, 6 - weekday(last)),
      label: `${MONTH_NAMES[month - 1]} ${year}`,
    };
  }
  if (view === "week") {
    const from = addDays(anchor, -weekday(anchor));
    const to = addDays(from, 6);
    return { from, to, label: rangeLabel(from, to) };
  }
  const to = addDays(anchor, AGENDA_DAYS - 1);
  return { from: anchor, to, label: rangeLabel(anchor, to) };
}

function rangeLabel(from: string, to: string): string {
  const a = parseKey(from);
  const b = parseKey(to);
  const left = `${SHORT_MONTHS[a.month - 1]} ${a.day}`;
  if (a.year !== b.year) return `${left}, ${a.year} – ${SHORT_MONTHS[b.month - 1]} ${b.day}, ${b.year}`;
  if (a.month !== b.month) return `${left} – ${SHORT_MONTHS[b.month - 1]} ${b.day}, ${b.year}`;
  return `${left} – ${b.day}, ${b.year}`;
}

/** Where the previous/next buttons go. */
export function stepAnchor(view: CalendarView, anchor: string, dir: 1 | -1): string {
  if (view === "month") return addMonths(makeKey(parseKey(anchor).year, parseKey(anchor).month, 1), dir);
  if (view === "week") return addDays(anchor, 7 * dir);
  return addDays(anchor, AGENDA_DAYS * dir);
}

/** "9:30 AM" from minutes after midnight. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Thursday, November 12" for a day key. */
export function longDayLabel(key: string): string {
  const { year, month, day } = parseKey(key);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const KIND_ORDER: Record<CalendarItemKind, number> = { birthday: 0, external: 1, meeting: 2, task: 3 };

/** All-day items first, then by time, then by kind. */
export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => {
    const am = a.minutes ?? -1;
    const bm = b.minutes ?? -1;
    if (am !== bm) return am - bm;
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.title.localeCompare(b.title);
  });
}

export function groupByDay(items: CalendarItem[]): Record<string, CalendarItem[]> {
  const out: Record<string, CalendarItem[]> = {};
  for (const item of items) (out[item.day] ??= []).push(item);
  for (const k of Object.keys(out)) out[k] = sortItems(out[k]);
  return out;
}
