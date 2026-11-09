/**
 * The presets each setting allows. Shared by the Settings page and the
 * server actions that validate saves; the database CHECKs in
 * lib/db/schema.ts (user_settings) enforce the same lists.
 */
export const REMINDER_LEAD_OPTIONS = [5, 10, 30, 60] as const;
export const IDLE_TIMEOUT_OPTIONS = [15, 30, 60] as const;

export type UserSettings = {
  reminderLeadMinutes: (typeof REMINDER_LEAD_OPTIONS)[number];
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
  quietHoursEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
  idleTimeoutMinutes: (typeof IDLE_TIMEOUT_OPTIONS)[number];
};

export const DEFAULT_SETTINGS: UserSettings = {
  reminderLeadMinutes: 10,
  dailySummaryEnabled: false,
  dailySummaryHour: 8,
  quietHoursEnabled: false,
  quietStartHour: 21,
  quietEndHour: 7,
  idleTimeoutMinutes: 30,
};

/** "8 AM", "12 PM", "9 PM" for an hour 0–23. */
export function hourLabel(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

/** Support contact shown under Settings → About. */
export const SUPPORT_EMAIL = "dante@sonderproject.co";
