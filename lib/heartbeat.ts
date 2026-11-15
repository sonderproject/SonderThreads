import { query } from "@/lib/db/client";

/**
 * "Last worked at" stamps for the command center's Health tab (app_meta):
 * email_sent_at, stripe_webhook_at, cron_reminders_at. Never throws.
 */
export async function heartbeat(key: "email_sent_at" | "stripe_webhook_at" | "cron_reminders_at"): Promise<void> {
  try {
    await query(
      `insert into app_meta (key, value) values ($1, now()::text) on conflict (key) do update set value = excluded.value`,
      [key],
    );
  } catch {
    // Health stamps must never break the request they describe.
  }
}
