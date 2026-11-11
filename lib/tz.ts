/**
 * Time-zone-aware date helpers, safe on server and client. The server runs
 * in UTC on Vercel, so anything that depends on "today" or a calendar day
 * must use the viewer's zone (see lib/timezone.ts) rather than the machine's.
 */

export const TZ_COOKIE = "tz";

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DD" of the given instant in `tz`. */
export function dayKey(value: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(value),
  );
}

/** Year, month (1-12) and day of the given instant in `tz`. */
export function dateParts(value: string | Date, tz: string): { year: number; month: number; day: number } {
  const [year, month, day] = dayKey(value, tz).split("-").map(Number);
  return { year, month, day };
}

/** Hour and minute of the given instant in `tz`. */
export function timeParts(value: string | Date, tz: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(
    new Date(value),
  );
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour"), minute: get("minute") };
}

/** Milliseconds `tz` is ahead of UTC at the given instant (e.g. -6h for Chicago in winter). */
export function zoneOffsetMs(at: Date, tz: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - (at.getTime() - at.getMilliseconds());
}

/** The instant local midnight began, in `tz`, on the day containing `at`. */
export function startOfDayIn(at: Date, tz: string): number {
  const { year, month, day } = dateParts(at, tz);
  const guess = Date.UTC(year, month - 1, day);
  return guess - zoneOffsetMs(new Date(guess), tz);
}
