import { NextResponse, type NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { deliver } from "@/lib/notify";
import { inQuietHoursSql } from "@/lib/notify/quiet-hours";

export const dynamic = "force-dynamic";

/**
 * Sends push/text reminders for tasks that are coming due, and each user's
 * daily summary. Called on a schedule (vercel.json, or any outside cron
 * service) with "Authorization: Bearer $CRON_SECRET" — Vercel Cron adds that
 * header itself. A system job with no signed-in user, so it reads user ids
 * from the rows it acts on rather than requireUserId().
 *
 * Timed tasks are reminded the user's chosen number of minutes before
 * (Settings → Notifications, default 10); all-day tasks (midnight in the
 * user's time zone) at 8am. Each task is reminded once (reminded_at), and
 * anything more than a day overdue is skipped so a first run doesn't flood
 * anyone. During a user's quiet hours nothing is sent; their reminders wait
 * for the first run after quiet hours end.
 *
 * Times are only as precise as the schedule: once a day on Vercel Hobby.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await query<{ id: string; user_id: string; title: string }>(
    `update tasks t set reminded_at = now()
      where t.id in (
          select t2.id from tasks t2
            join users u2 on u2.id = t2.user_id
            left join user_settings us2 on us2.user_id = u2.id
           where t2.completed = false and t2.deleted_at is null and t2.reminded_at is null
             and t2.due_at is not null and t2.due_at > now() - interval '1 day'
             and not ${inQuietHoursSql("u2", "us2")}
             and case
                   when (t2.due_at at time zone coalesce(u2.timezone, 'UTC'))::time = '00:00'
                     then t2.due_at + interval '8 hours'
                   else t2.due_at - make_interval(mins => coalesce(us2.reminder_lead_minutes, 10))
                 end <= now()
           order by t2.due_at
           limit 200
           for update of t2 skip locked
        )
      returning t.id, t.user_id, t.title`,
  );

  for (const task of due) {
    // Due tasks already show on the Notifications page, so this only sends.
    await deliver(task.user_id, {
      title: `Due: ${task.title}`,
      href: `/tasks#${task.id}`,
      channels: ["push", "sms"],
    }).catch((err) => console.error("[cron/reminders] send failed", task.id, err));
  }

  const summaries = await sendDailySummaries();
  return NextResponse.json({ reminded: due.length, summaries });
}

/**
 * Daily summary: once per local day, at or after the user's chosen hour
 * (outside quiet hours), a short "what's on today" by push/text.
 */
async function sendDailySummaries(): Promise<number> {
  const users = await query<{ user_id: string; tz: string }>(
    `update user_settings us
        set daily_summary_sent_on = (now() at time zone coalesce(u.timezone, 'UTC'))::date
       from users u
      where u.id = us.user_id
        and us.daily_summary_enabled
        and (us.daily_summary_sent_on is null
             or us.daily_summary_sent_on < (now() at time zone coalesce(u.timezone, 'UTC'))::date)
        and extract(hour from now() at time zone coalesce(u.timezone, 'UTC')) >= us.daily_summary_hour
        and not ${inQuietHoursSql("u", "us")}
      returning us.user_id, coalesce(u.timezone, 'UTC') as tz`,
  );

  for (const { user_id, tz } of users) {
    try {
      const counts = await queryOne<{ today: number; overdue: number }>(
        `select
           count(*) filter (where (due_at at time zone $2)::date = (now() at time zone $2)::date and due_at >= now())::int as today,
           count(*) filter (where due_at < now())::int as overdue
           from tasks
          where user_id = $1 and deleted_at is null and completed = false and due_at is not null`,
        [user_id, tz],
      );
      const today = counts?.today ?? 0;
      const overdue = counts?.overdue ?? 0;
      const parts = [
        today === 0 ? "Nothing else due today" : `${today} task${today === 1 ? "" : "s"} due today`,
        overdue > 0 ? `${overdue} overdue` : null,
      ].filter(Boolean);
      await deliver(user_id, {
        title: "Your day",
        body: `${parts.join(", ")}.`,
        href: "/",
        channels: ["push", "sms"],
      });
    } catch (err) {
      console.error("[cron/reminders] daily summary failed", user_id, err);
    }
  }
  return users.length;
}
