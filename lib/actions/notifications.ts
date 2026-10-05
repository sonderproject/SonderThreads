"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { deleteTask } from "./tasks";
import { deliver } from "@/lib/notify";
import { pushConfigured } from "@/lib/notify/push";
import { smsConfigured } from "@/lib/notify/sms";
import { normalizePhone, validTimeZone } from "@/lib/notify/phone";
import type { Person, Task } from "@/lib/types";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  task_id: string | null;
  note_id: string | null;
  person_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type UpcomingBirthday = { id: string; display_name: string; month_day: string };

export async function getNotificationsFeed(): Promise<{
  notifications: AppNotification[];
  tasks: Task[];
  birthdays: UpcomingBirthday[];
  needsAttention: Person[];
}> {
  const userId = await requireUserId();
  const [notifications, tasks, birthdays, needsAttention] = await Promise.all([
    query<AppNotification>(
      `select id, type, title, body, href, task_id, note_id, person_id, read_at, created_at
         from notifications where user_id = $1 order by created_at desc limit 50`,
      [userId],
    ),
    // Overdue, due today, and the next couple of days. The page sorts them
    // into those groups in the browser, in the user's own time zone.
    query<Task>(
      `select * from tasks
        where user_id = $1 and deleted_at is null and completed = false
          and due_at is not null and due_at < now() + interval '3 days'
        order by due_at asc limit 100`,
      [userId],
    ),
    query<UpcomingBirthday>(
      `select id, display_name, to_char(birthday, 'MM-DD') as month_day from people
        where user_id = $1 and deleted_at is null and birthday is not null
          and to_char(birthday, 'MM-DD') in (
            select to_char(d, 'MM-DD') from generate_series(current_date - 1, current_date + 7, interval '1 day') d
          )`,
      [userId],
    ),
    query<Person>(
      `select distinct p.* from people p
         left join tasks t on t.person_id = p.id and t.user_id = $1 and t.completed = false
          and t.due_at is not null and t.due_at < now() and t.deleted_at is null
        where p.user_id = $1 and p.deleted_at is null
          and (p.needs_followup = true or p.last_activity_at < now() - interval '7 days' or t.id is not null)
        order by p.last_activity_at asc limit 10`,
      [userId],
    ),
  ]);
  return { notifications, tasks, birthdays, needsAttention };
}

/** The bell's number: unread notifications plus open tasks already past due. */
export async function getNotificationCount(): Promise<number> {
  const userId = await requireUserId();
  const row = await queryOne<{ n: number }>(
    `select
       (select count(*) from notifications where user_id = $1 and read_at is null)::int +
       (select count(*) from tasks where user_id = $1 and deleted_at is null and completed = false
          and due_at is not null and due_at <= now())::int as n`,
    [userId],
  );
  return row?.n ?? 0;
}

export async function markNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  await query(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [userId]);
  revalidatePath("/", "layout");
}

export async function dismissNotification(id: string): Promise<void> {
  const userId = await requireUserId();
  await query(`delete from notifications where user_id = $1 and id = $2`, [userId, id]);
  revalidatePath("/notifications");
}

/** "Undo" on a task made from a note: deletes the task (the note stays) and its notification. */
export async function undoTaskFromNote(notificationId: string): Promise<void> {
  const userId = await requireUserId();
  const n = await queryOne<{ task_id: string | null }>(
    `select task_id from notifications where user_id = $1 and id = $2`,
    [userId, notificationId],
  );
  if (n?.task_id) await deleteTask(n.task_id);
  await dismissNotification(notificationId);
}

// --- Push / text settings -------------------------------------------------

export type NotificationSettings = {
  phone: string | null;
  smsOptIn: boolean;
  smsAvailable: boolean;
  pushAvailable: boolean;
  pushPublicKey: string | null;
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const userId = await requireUserId();
  const user = await queryOne<{ phone: string | null; sms_opt_in: boolean }>(
    `select phone, sms_opt_in from users where id = $1`,
    [userId],
  );
  return {
    phone: user?.phone ?? null,
    smsOptIn: user?.sms_opt_in ?? false,
    smsAvailable: smsConfigured(),
    pushAvailable: pushConfigured(),
    pushPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  };
}

/** Saves the phone number and text-message consent from the Account page. */
export async function saveContactSettings(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const raw = formData.get("phone")?.toString() ?? "";
  const phone = raw.trim() ? normalizePhone(raw) : null;
  if (raw.trim() && !phone) redirect("/account?error=phone");
  const smsOptIn = formData.get("sms_opt_in") === "on" && !!phone;
  const tz = validTimeZone(formData.get("timezone")?.toString());
  await query(
    `update users set phone = $1, sms_opt_in = $2, timezone = coalesce($3, timezone), updated_at = now() where id = $4`,
    [phone, smsOptIn, tz, userId],
  );
  revalidatePath("/account");
}

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  timeZone?: string;
}): Promise<void> {
  const userId = await requireUserId();
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("Bad subscription");
  await query(
    `insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [sub.endpoint, userId, sub.keys.p256dh, sub.keys.auth],
  );
  const tz = validTimeZone(sub.timeZone);
  if (tz) await query(`update users set timezone = $1 where id = $2`, [tz, userId]);
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const userId = await requireUserId();
  await query(`delete from push_subscriptions where user_id = $1 and endpoint = $2`, [userId, endpoint]);
}

/** Sends a test by push and text, so the user can check both work. */
export async function sendTestNotification(): Promise<void> {
  const userId = await requireUserId();
  await deliver(userId, {
    title: "Test notification",
    body: "Notifications are working.",
    href: "/notifications",
    channels: ["push", "sms"],
  });
}
