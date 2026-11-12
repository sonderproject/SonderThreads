import { query, queryOne } from "@/lib/db/client";
import { buildIcs, type IcsOutEvent } from "@/lib/ical";
import { termsFor } from "@/lib/terms";
import { appUrl } from "@/lib/email";

/**
 * Your Strynd calendar as an .ics feed, for subscribing from Google, Apple or
 * Outlook. Calendar apps fetch it without signing in, so the secret token in
 * the link is what identifies the account (Settings → Calendar can reset it).
 * Like the Stripe webhook, this is one of the few places the user id comes
 * from something other than requireUserId(): the token lookup below.
 *
 * Holds task titles and the names of people you met, with times. No notes,
 * meeting reasons or other client details, since it ends up in another company's calendar.
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

  const [tasks, checkIns, org] = await Promise.all([
    query<{ id: string; title: string; due_at: string }>(
      `select id, title, due_at from tasks
       where user_id = $1 and deleted_at is null and not completed and due_at >= $2 and due_at < $3
       order by due_at limit 3000`,
      [userId, from, to],
    ),
    query<{ id: string; checked_in_at: string; display_name: string }>(
      `select c.id, c.checked_in_at, p.display_name
       from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
       where c.user_id = $1 and c.deleted_at is null and c.checked_in_at >= $2 and c.checked_in_at < $3
       order by c.checked_in_at limit 3000`,
      [userId, from, to],
    ),
    queryOne(`select 1 from memberships where user_id = $1 and active`, [userId]),
  ]);

  const terms = termsFor(Boolean(org));
  const base = appUrl();
  const events: IcsOutEvent[] = [
    ...tasks.map((t) => ({
      uid: `task-${t.id}@strynd`,
      title: t.title,
      start: new Date(t.due_at),
      minutes: 15,
      url: `${base}/tasks#${t.id}`,
    })),
    ...checkIns.map((c) => ({
      uid: `checkin-${c.id}@strynd`,
      title: `${terms.checkIn}: ${c.display_name}`,
      start: new Date(c.checked_in_at),
      minutes: 30,
      url: `${base}/check-ins`,
    })),
  ];

  return new Response(buildIcs("Strynd", events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="strynd.ics"',
      "cache-control": "private, max-age=300",
      "x-robots-tag": "noindex",
    },
  });
}
