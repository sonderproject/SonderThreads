import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings-options";

type Row = {
  reminder_lead_minutes: number;
  daily_summary_enabled: boolean;
  daily_summary_hour: number;
  quiet_hours_enabled: boolean;
  quiet_start_hour: number;
  quiet_end_hour: number;
  idle_timeout_minutes: number;
  stay_signed_in: boolean;
};

/** The signed-in user's settings, with defaults for anything never saved. */
export async function getUserSettings(): Promise<UserSettings> {
  const userId = await requireUserId();
  const row = await queryOne<Row>(
    `select reminder_lead_minutes, daily_summary_enabled, daily_summary_hour, quiet_hours_enabled,
            quiet_start_hour, quiet_end_hour, idle_timeout_minutes, stay_signed_in
       from user_settings where user_id = $1`,
    [userId],
  );
  if (!row) return DEFAULT_SETTINGS;
  return {
    reminderLeadMinutes: row.reminder_lead_minutes as UserSettings["reminderLeadMinutes"],
    dailySummaryEnabled: row.daily_summary_enabled,
    dailySummaryHour: row.daily_summary_hour,
    quietHoursEnabled: row.quiet_hours_enabled,
    quietStartHour: row.quiet_start_hour,
    quietEndHour: row.quiet_end_hour,
    idleTimeoutMinutes: row.idle_timeout_minutes as UserSettings["idleTimeoutMinutes"],
    staySignedIn: row.stay_signed_in,
  };
}
