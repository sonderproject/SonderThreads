import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";

export type WelcomeStep = { key: "person" | "checkin" | "note" | "phone"; done: boolean };

/**
 * The first-run checklist on Home, for accounts younger than 30 days that
 * haven't dismissed it. Steps tick themselves off from real data, except
 * "on your phone", which the person marks done. Null = don't show.
 */
export async function getWelcome(): Promise<WelcomeStep[] | null> {
  const userId = await requireUserId();
  const row = await queryOne<{ show: boolean; people: number; checkins: number; notes: number; phone: boolean }>(
    `select (u.welcome_dismissed_at is null and u.created_at > now() - interval '30 days') as show,
            (select count(*) from people where user_id = $1 and deleted_at is null)::int as people,
            (select count(*) from check_ins where user_id = $1 and deleted_at is null)::int as checkins,
            ((select count(*) from notes where user_id = $1 and deleted_at is null) +
             (select count(*) from tasks where user_id = $1 and deleted_at is null))::int as notes,
            u.welcome_phone_done as phone
       from users u where u.id = $1`,
    [userId],
  );
  if (!row?.show) return null;
  const steps: WelcomeStep[] = [
    { key: "person", done: row.people > 0 },
    { key: "checkin", done: row.checkins > 0 },
    { key: "note", done: row.notes > 0 },
    { key: "phone", done: row.phone },
  ];
  return steps.every((s) => s.done) ? null : steps;
}
