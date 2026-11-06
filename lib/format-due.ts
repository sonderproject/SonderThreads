import { timeParts } from "@/lib/tz";

/**
 * "Mon, Sep 28" for all-day items, "Mon, Sep 28 · 3:00 PM" when a time was
 * set. Pass the viewer's time zone (useTimeZone / getTimeZone) so the server
 * render matches the browser; without it, the machine's zone is used.
 */
export function formatDue(value: string | Date, timeZone?: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone });
  const { hour, minute } = timeZone ? timeParts(d, timeZone) : { hour: d.getHours(), minute: d.getMinutes() };
  if (hour === 0 && minute === 0) return date;
  return `${date} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone })}`;
}
