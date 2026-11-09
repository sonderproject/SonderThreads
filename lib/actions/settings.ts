"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { REMINDER_LEAD_OPTIONS } from "@/lib/settings-options";
import { validTimeZone } from "@/lib/notify/phone";

function preset<T extends number>(raw: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  const n = Number(raw);
  return (allowed as readonly number[]).includes(n) ? (n as T) : fallback;
}

function hour(raw: FormDataEntryValue | null, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}

/**
 * Settings → Notifications: text consent (needs a number, set under Account),
 * time zone, reminder timing, daily summary and quiet hours.
 */
export async function saveNotificationPrefs(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await query(
    `update users set sms_opt_in = $1 and phone is not null, timezone = coalesce($2, timezone), updated_at = now()
      where id = $3`,
    [formData.get("sms_opt_in") === "on", validTimeZone(formData.get("timezone")?.toString()), userId],
  );
  const values = [
    preset(formData.get("reminder_lead_minutes"), REMINDER_LEAD_OPTIONS, 10),
    formData.get("daily_summary_enabled") === "on",
    hour(formData.get("daily_summary_hour"), 8),
    formData.get("quiet_hours_enabled") === "on",
    hour(formData.get("quiet_start_hour"), 21),
    hour(formData.get("quiet_end_hour"), 7),
  ];
  await query(
    `insert into user_settings (user_id, reminder_lead_minutes, daily_summary_enabled, daily_summary_hour,
                                quiet_hours_enabled, quiet_start_hour, quiet_end_hour)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (user_id) do update set
       reminder_lead_minutes = excluded.reminder_lead_minutes,
       daily_summary_enabled = excluded.daily_summary_enabled,
       daily_summary_hour = excluded.daily_summary_hour,
       quiet_hours_enabled = excluded.quiet_hours_enabled,
       quiet_start_hour = excluded.quiet_start_hour,
       quiet_end_hour = excluded.quiet_end_hour,
       updated_at = now()`,
    [userId, ...values],
  );
  revalidatePath("/settings");
}
