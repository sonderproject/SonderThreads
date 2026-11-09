/**
 * The presets each setting allows. Shared by the Settings page and the
 * server actions that validate saves; the database CHECKs in
 * lib/db/schema.ts (user_settings) enforce the same lists.
 */
export const REMINDER_LEAD_OPTIONS = [5, 10, 30, 60] as const;
/** Auto-lock choices in minutes (5 min to 8 hours). Keep in sync with the CHECK in lib/db/schema.ts. */
export const IDLE_TIMEOUT_OPTIONS = [5, 15, 30, 60, 120, 240, 480] as const;

/** "5 minutes", "1 hour", "8 hours". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = minutes / 60;
  return `${h} hour${h === 1 ? "" : "s"}`;
}

export type UserSettings = {
  reminderLeadMinutes: (typeof REMINDER_LEAD_OPTIONS)[number];
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
  quietHoursEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
  idleTimeoutMinutes: (typeof IDLE_TIMEOUT_OPTIONS)[number];
  /** No auto-lock at all: stay signed in until signing out. */
  staySignedIn: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  reminderLeadMinutes: 10,
  dailySummaryEnabled: false,
  dailySummaryHour: 8,
  quietHoursEnabled: false,
  quietStartHour: 21,
  quietEndHour: 7,
  idleTimeoutMinutes: 30,
  staySignedIn: false,
};

/** "8 AM", "12 PM", "9 PM" for an hour 0–23. */
export function hourLabel(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

/** Support contact shown under Settings → About. */
export const SUPPORT_EMAIL = "dante@sonderproject.co";
