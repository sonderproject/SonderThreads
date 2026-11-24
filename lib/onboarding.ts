import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";

export type WelcomeStep = { key: "person" | "checkin" | "note" | "team"; done: boolean };

/**
 * The first-run "Getting started" checklist on Home: three steps that tick
 * themselves off from real data, for accounts younger than 30 days that
 * haven't hidden it. Organization admins get "Invite a teammate" as the third
 * step; everyone else "Write a note or a task". Null = don't show.
 */
export async function getWelcome(): Promise<WelcomeStep[] | null> {
  const userId = await requireUserId();
  const row = await queryOne<{ show: boolean; people: number; checkins: number; notes: number; admin: boolean; team: number }>(
    `select (u.welcome_dismissed_at is null and u.created_at > now() - interval '30 days') as show,
            (select count(*) from people where user_id = $1 and deleted_at is null)::int as people,
            (select count(*) from check_ins where user_id = $1 and deleted_at is null)::int as checkins,
            ((select count(*) from notes where user_id = $1 and deleted_at is null) +
             (select count(*) from tasks where user_id = $1 and deleted_at is null))::int as notes,
            coalesce(m.role = 'admin', false) as admin,
            case when m.org_id is null then 0 else
              (select count(*) from memberships x where x.org_id = m.org_id and x.user_id <> $1) +
              (select count(*) from invitations i where i.org_id = m.org_id) end::int as team
       from users u
       left join memberships m on m.user_id = u.id and m.active
      where u.id = $1
      limit 1`,
    [userId],
  );
  if (!row?.show) return null;
  const steps: WelcomeStep[] = [
    { key: "person", done: row.people > 0 },
    { key: "checkin", done: row.checkins > 0 },
    row.admin ? { key: "team", done: row.team > 0 } : { key: "note", done: row.notes > 0 },
  ];
  return steps.every((s) => s.done) ? null : steps;
}
