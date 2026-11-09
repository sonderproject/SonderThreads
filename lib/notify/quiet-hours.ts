import { queryOne } from "@/lib/db/client";

/**
 * SQL that is true while a user is inside their quiet hours, in their own
 * time zone. `u` is the users row and `us` their (left-joined, possibly
 * null) user_settings row. Wraps past midnight (e.g. 9 PM–7 AM).
 */
export function inQuietHoursSql(u: string, us: string): string {
  const hour = `extract(hour from now() at time zone coalesce(${u}.timezone, 'UTC'))`;
  return `(coalesce(${us}.quiet_hours_enabled, false)
    and ${us}.quiet_start_hour <> ${us}.quiet_end_hour
    and case when ${us}.quiet_start_hour < ${us}.quiet_end_hour
             then ${hour} >= ${us}.quiet_start_hour and ${hour} < ${us}.quiet_end_hour
             else ${hour} >= ${us}.quiet_start_hour or ${hour} < ${us}.quiet_end_hour end)`;
}

/** True if the user is in quiet hours right now (push and texts wait until they end). */
export async function inQuietHours(userId: string): Promise<boolean> {
  const row = await queryOne<{ quiet: boolean }>(
    `select ${inQuietHoursSql("u", "us")} as quiet
       from users u left join user_settings us on us.user_id = u.id
      where u.id = $1`,
    [userId],
  );
  return Boolean(row?.quiet);
}
