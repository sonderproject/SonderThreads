/** Snooze targets, computed in the browser so they're in the user's local time. */
export type SnoozeOption = { label: string; hint: string; at: Date };

function at(base: Date, days: number, hour: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const short = (d: Date) =>
  d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: d.getMinutes() ? "2-digit" : undefined });

export function snoozeOptions(now = new Date()): SnoozeOption[] {
  const options: SnoozeOption[] = [];

  if (now.getHours() < 20) {
    const later = new Date(now);
    later.setHours(now.getHours() + 3, 0, 0, 0);
    options.push({ label: "Later today", hint: short(later), at: later });
  }

  const tomorrow = at(now, 1, 9);
  options.push({ label: "Tomorrow", hint: short(tomorrow), at: tomorrow });

  // Upcoming Saturday; if it's already the weekend, the next one.
  const toSaturday = (6 - now.getDay() + 7) % 7 || 7;
  const weekend = at(now, toSaturday, 9);
  if (toSaturday !== 1) options.push({ label: "This weekend", hint: short(weekend), at: weekend });

  const toMonday = (1 - now.getDay() + 7) % 7 || 7;
  const nextWeek = at(now, toMonday, 9);
  options.push({ label: "Next week", hint: short(nextWeek), at: nextWeek });

  return options;
}
