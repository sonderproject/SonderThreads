import webpush from "web-push";
import { query } from "@/lib/db/client";

/**
 * Web Push (no third-party service): the browser vendor's push server
 * delivers it, signed with our VAPID keys. Generate a key pair once with
 * `npx web-push generate-vapid-keys` and set NEXT_PUBLIC_VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: or https: URL).
 */
export function pushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;

export type PushPayload = { title: string; body?: string | null; url?: string | null };

/** Sends to every device the user turned push on in. Dead subscriptions are removed. */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:no-reply@sonderthreads.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }

  const subs = await query<{ endpoint: string; p256dh: string; auth: string }>(
    `select endpoint, p256dh, auth from push_subscriptions where user_id = $1`,
    [userId],
  );
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await query(`delete from push_subscriptions where endpoint = $1`, [s.endpoint]);
        } else {
          console.error("[push] send failed", status, err);
        }
      }
    }),
  );
  return sent;
}
