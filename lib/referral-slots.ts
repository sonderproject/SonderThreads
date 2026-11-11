import { dayKey, zoneOffsetMs } from "./tz.ts";

/**
 * Referral appointment slots. Pure (no database), so the public form, the
 * server check on submit and the tests all agree.
 *
 * An organization opens hours per weekday (in its own time zone), slots are
 * `slotMinutes` long with one client each, and it can cap how many
 * appointments it takes per day, week (Monday–Sunday) and month. Caps never
 * stop a referral: they only push the appointment to the next opening.
 */

/** 0 = Sunday … 6 = Saturday → open windows as "HH:MM" pairs. */
export type WeeklyHours = Record<string, [string, string][]>;

export const DEFAULT_HOURS: WeeklyHours = {
  "1": [["10:00", "13:00"]],
  "2": [["10:00", "13:00"]],
  "3": [["10:00", "13:00"]],
  "4": [["10:00", "13:00"]],
  "5": [["10:00", "13:00"]],
};
export const DEFAULT_SLOT_MINUTES = 30;
export const SLOT_CHOICES = [15, 30, 45, 60] as const;
/** How far ahead the form offers times. */
export const BOOKING_DAYS = 14;
/** No booking closer than this to the start time. */
export const MIN_LEAD_MINUTES = 60;

export type Caps = { day: number | null; week: number | null; month: number | null };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesOf(hhmm: string): number | null {
  const m = HHMM.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Keeps only well-formed windows (start before end, 0–6 weekdays). */
export function cleanHours(input: unknown): WeeklyHours {
  const out: WeeklyHours = {};
  if (!input || typeof input !== "object") return out;
  for (const [day, windows] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(day) || !Array.isArray(windows)) continue;
    const good = windows.filter(
      (w): w is [string, string] =>
        Array.isArray(w) && typeof w[0] === "string" && typeof w[1] === "string" && (minutesOf(w[0]) ?? 1e9) < (minutesOf(w[1]) ?? -1),
    );
    if (good.length) out[day] = good.map(([a, b]) => [a, b]);
  }
  return out;
}

/** The UTC instant of a local wall-clock time in `tz` (handles daylight saving). */
export function localToUtc(year: number, month: number, day: number, minutes: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  let t = guess - zoneOffsetMs(new Date(guess), tz);
  t = guess - zoneOffsetMs(new Date(t), tz);
  return new Date(t);
}

/** Every slot start in the next `days` days (from `now`), within open hours, at least the lead time away. */
export function generateSlots(opts: {
  hours: WeeklyHours;
  slotMinutes: number;
  tz: string;
  now: Date;
  days?: number;
  leadMinutes?: number;
}): Date[] {
  const { hours, slotMinutes, tz, now } = opts;
  const days = opts.days ?? BOOKING_DAYS;
  const earliest = now.getTime() + (opts.leadMinutes ?? MIN_LEAD_MINUTES) * 60_000;
  const slots: Date[] = [];
  const [y, m, d] = dayKey(now, tz).split("-").map(Number);
  for (let i = 0; i < days; i++) {
    const cal = new Date(Date.UTC(y, m - 1, d + i));
    const weekday = cal.getUTCDay();
    for (const [start, end] of hours[String(weekday)] ?? []) {
      const s = minutesOf(start);
      const e = minutesOf(end);
      if (s === null || e === null) continue;
      for (let t = s; t + slotMinutes <= e; t += slotMinutes) {
        const at = localToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), t, tz);
        if (at.getTime() >= earliest) slots.push(at);
      }
    }
  }
  return slots;
}

/** Day "YYYY-MM-DD", week (the Monday it starts on) and month "YYYY-MM" of an instant, in `tz`. */
export function periodKeys(at: Date, tz: string): { day: string; week: string; month: string } {
  const day = dayKey(at, tz);
  const [y, m, d] = day.split("-").map(Number);
  const cal = new Date(Date.UTC(y, m - 1, d));
  const back = (cal.getUTCDay() + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
  return { day, week: monday, month: day.slice(0, 7) };
}

export type SlotPlan = {
  /** Slots that can be booked right now. */
  open: Date[];
  /** True when caps (not bookings or hours) pushed out an earlier time. */
  pushedByLimits: boolean;
  /** Which limit was hit first, for the message. */
  fullPeriod: "day" | "week" | "month" | null;
};

/**
 * Which slots are bookable: not already taken, and not in a day, week or
 * month that has reached its cap (counting appointments already booked).
 */
export function planSlots(opts: { slots: Date[]; booked: Date[]; caps: Caps; tz: string }): SlotPlan {
  const { slots, booked, caps, tz } = opts;
  const taken = new Set(booked.map((b) => b.getTime()));
  const count = { day: new Map<string, number>(), week: new Map<string, number>(), month: new Map<string, number>() };
  for (const b of booked) {
    const k = periodKeys(b, tz);
    for (const p of ["day", "week", "month"] as const) count[p].set(k[p], (count[p].get(k[p]) ?? 0) + 1);
  }
  const open: Date[] = [];
  let pushedByLimits = false;
  let fullPeriod: SlotPlan["fullPeriod"] = null;
  for (const s of slots) {
    if (taken.has(s.getTime())) continue;
    const k = periodKeys(s, tz);
    const full = (["day", "week", "month"] as const).find((p) => caps[p] !== null && (count[p].get(k[p]) ?? 0) >= (caps[p] as number));
    if (full) {
      if (!open.length) {
        pushedByLimits = true;
        fullPeriod ??= full;
      }
      continue;
    }
    open.push(s);
  }
  return { open, pushedByLimits, fullPeriod };
}

/** "Tue, Nov 18 · 10:30 AM" in the organization's zone. */
export function formatSlot(at: Date, tz: string): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(at);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
  return `${day} · ${time}`;
}
