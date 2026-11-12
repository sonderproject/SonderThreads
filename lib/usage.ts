import { query, queryOne } from "@/lib/db/client";
import { alertOwner, logEvent } from "@/lib/events";

/**
 * Per-user caps on anything that costs money (AI, transcription, texts) or a
 * lot of server time (report exports). Every use is counted per hour; a use
 * over the hourly or 24-hour cap is refused. Callers decide what refused
 * means: AI quietly falls back to the free built-in version, texts are
 * skipped (the in-app notice still shows), the rest get a clear message.
 * The owner is alerted the first time someone hits a cap each day.
 */
export const USAGE_LIMITS = {
  /** Voice → text (OpenAI). */
  transcribe: { perHour: 60, perDay: 300, label: "voice transcription" },
  /** AI reading a command-bar sentence. */
  "ai.command": { perHour: 120, perDay: 600, label: "AI command parsing" },
  /** AI writing a person's summary after a note. */
  "ai.summary": { perHour: 60, perDay: 300, label: "AI person summaries" },
  /** Text-message reminders (Twilio). */
  sms: { perHour: 10, perDay: 30, label: "text messages" },
  /** Report exports (PDF / Excel / CSV). */
  export: { perHour: 40, perDay: 150, label: "report exports" },
} as const;

export type UsageKind = keyof typeof USAGE_LIMITS;

/** Counts one use; true if it's within the caps. Never throws (a counter problem never blocks the app). */
export async function takeQuota(userId: string, kind: UsageKind): Promise<boolean> {
  const limit = USAGE_LIMITS[kind];
  try {
    const row = await queryOne<{ hour_count: number; day_count: number }>(
      `with bump as (
         insert into usage_counters (user_id, kind, hour, count) values ($1, $2, date_trunc('hour', now()), 1)
         on conflict (user_id, kind, hour) do update set count = usage_counters.count + 1
         returning count
       )
       select (select count from bump) as hour_count,
              (select coalesce(sum(count), 0) from usage_counters
                where user_id = $1 and kind = $2 and hour > now() - interval '24 hours')::int + 0 as day_count`,
      [userId, kind],
    );
    // The day total read above doesn't include this use yet (same statement), so add it.
    const hour = row?.hour_count ?? 1;
    const day = (row?.day_count ?? 0) + 1;
    // Now and then, drop counters older than two days.
    if (Math.random() < 0.01) await query(`delete from usage_counters where hour < now() - interval '2 days'`).catch(() => undefined);
    if (hour <= limit.perHour && day <= limit.perDay) return true;

    const first = hour === limit.perHour + 1 || day === limit.perDay + 1;
    if (first) {
      await logEvent("usage.cap", `Usage cap hit: ${limit.label}`, { level: "warn", meta: { user: userId, kind, hour, day } });
      await alertOwner(
        `Usage cap hit: ${limit.label}`,
        [
          `One account reached the cap for ${limit.label} (${limit.perHour} an hour / ${limit.perDay} a day).`,
          `It's limited until the window resets. If this is a real heavy user, raise the cap in lib/usage.ts.`,
        ],
        { key: `usage:${userId}:${kind}:${new Date().toISOString().slice(0, 10)}` },
      );
    }
    return false;
  } catch (err) {
    console.error("[usage] counter failed", kind, err);
    return true;
  }
}
