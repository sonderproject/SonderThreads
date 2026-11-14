import { query, queryOne } from "@/lib/db/client";
import { buildIcs, type IcsOutEvent } from "@/lib/ical";
import { appUrl } from "@/lib/email";

/**
 * Your Surfdesk calendar as an .ics feed, for subscribing from Google, Apple or
 * Outlook. Calendar apps fetch it without signing in, so the secret token in
 * the link is what identifies the account (Settings → Calendar can reset it).
 * Like the Stripe webhook, this is one of the few places the user id comes
 * from something other than requireUserId(): the token lookup below.
 *
 * Holds open task titles and due times only. No notes or other client
 * details, since it ends up in another company's calendar.
 */
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });

  const owner = await queryOne<{ user_id: string }>(
    `select s.user_id from user_settings s join users u on u.id = s.user_id where s.calendar_feed_token = $1`,
    [token],
  );
  if (!owner) return new Response("Not found", { status: 404 });
  const userId = owner.user_id;

  const now = Date.now();
  const from = new Date(now - 60 * DAY).toISOString();
  const to = new Date(now + 365 * DAY).toISOString();

  const tasks = await query<{ id: string; title: string; due_at: string }>(
    `select id, title, due_at from tasks
     where user_id = $1 and deleted_at is null and not completed and due_at >= $2 and due_at < $3
     order by due_at limit 3000`,
    [userId, from, to],
  );

  const base = appUrl();
  const events: IcsOutEvent[] = tasks.map((t) => ({
    // Keep "@strynd" (the old name): calendar apps match events by this id, so changing it would duplicate every task.
    uid: `task-${t.id}@strynd`,
    title: t.title,
    start: new Date(t.due_at),
    minutes: 15,
    url: `${base}/tasks#${t.id}`,
  }));

  return new Response(buildIcs("Surfdesk", events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="surfdesk.ics"',
      "cache-control": "private, max-age=300",
      "x-robots-tag": "noindex",
    },
  });
}
