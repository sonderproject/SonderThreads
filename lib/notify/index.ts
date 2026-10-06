import { query, queryOne } from "@/lib/db/client";
import { appUrl } from "@/lib/email";
import { sendPush } from "./push";
import { sendSms } from "./sms";

export type NotifyChannel = "push" | "sms";

export type NotifyParams = {
  type: string;
  title: string;
  body?: string | null;
  /** In-app path to open, e.g. "/tasks#<id>". */
  href?: string | null;
  taskId?: string | null;
  noteId?: string | null;
  personId?: string | null;
  /** Extra data for the Notifications page, e.g. a suggested task's details. */
  payload?: Record<string, unknown> | null;
  /** Where else to send it besides the Notifications page. Default: nowhere. */
  channels?: NotifyChannel[];
};

/**
 * The one place notifications go out: saves it to the Notifications page,
 * then sends it by push and/or text if asked and the user has them on.
 * Callers pass the user id from requireUserId(); background jobs with no
 * session (the reminders cron) read it from the row they're acting on.
 */
export async function notify(userId: string, n: NotifyParams): Promise<void> {
  await query(
    `insert into notifications (user_id, type, title, body, href, task_id, note_id, person_id, payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      userId,
      n.type,
      n.title,
      n.body ?? null,
      n.href ?? null,
      n.taskId ?? null,
      n.noteId ?? null,
      n.personId ?? null,
      n.payload ? JSON.stringify(n.payload) : null,
    ],
  );
  await deliver(userId, n);
}

/** Sends by push/text without saving a row — for test messages. */
export async function deliver(userId: string, n: Omit<NotifyParams, "type" | "payload">): Promise<void> {
  const channels = n.channels ?? [];
  const url = n.href ?? "/notifications";

  if (channels.includes("push")) {
    await sendPush(userId, { title: n.title, body: n.body, url }).catch((err) =>
      console.error("[notify] push failed", err),
    );
  }

  if (channels.includes("sms")) {
    const user = await queryOne<{ phone: string | null; sms_opt_in: boolean }>(
      `select phone, sms_opt_in from users where id = $1`,
      [userId],
    );
    if (user?.phone && user.sms_opt_in) {
      const text = [`sonderthreads: ${n.title}`, n.body, `${appUrl()}${url}`].filter(Boolean).join("\n");
      await sendSms(user.phone, text).catch((err) => console.error("[notify] sms failed", err));
    }
  }
}
