import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db/client";
import { deliver } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Sends push/text reminders for tasks that are coming due. Called on a
 * schedule (vercel.json, or any outside cron service) with
 * "Authorization: Bearer $CRON_SECRET" — Vercel Cron adds that header
 * itself. A system job with no signed-in user, so it reads user ids from the
 * task rows rather than requireUserId().
 *
 * Timed tasks are reminded ~10 minutes before; all-day tasks (midnight in
 * the user's time zone) at 8am. Each task is reminded once (reminded_at),
 * and anything more than a day overdue is skipped so a first run doesn't
 * flood anyone.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await query<{ id: string; user_id: string; title: string }>(
    `update tasks t set reminded_at = now()
       from users u
      where u.id = t.user_id
        and t.id in (
          select t2.id from tasks t2 join users u2 on u2.id = t2.user_id
           where t2.completed = false and t2.deleted_at is null and t2.reminded_at is null
             and t2.due_at is not null and t2.due_at > now() - interval '1 day'
             and case
                   when (t2.due_at at time zone coalesce(u2.timezone, 'UTC'))::time = '00:00'
                     then t2.due_at + interval '8 hours'
                   else t2.due_at - interval '10 minutes'
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

  return NextResponse.json({ reminded: due.length });
}
