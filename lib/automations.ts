import { query } from "@/lib/db/client";

/**
 * Automations (Settings → Automations): simple rules that create follow-up
 * tasks for the rule's owner, about the people they own. Run by the 5-minute
 * cron (app/api/cron/reminders). automation_runs remembers what each rule did,
 * so nothing is created twice, and each rule makes at most DAILY_CAP tasks a
 * day so turning one on never floods anyone's task list.
 */
export type AutomationKind = "quiet" | "new_person" | "birthday";

export const AUTOMATIONS: { kind: AutomationKind; title: string; describe: (days: number) => string; days: number[]; defaultDays: number }[] = [
  {
    kind: "quiet",
    title: "Gone quiet",
    describe: (d) => `When someone has had no activity for ${d} days, add a task to check in with them.`,
    days: [14, 30, 60, 90],
    defaultDays: 30,
  },
  {
    kind: "new_person",
    title: "New person follow-up",
    describe: (d) => `${d} ${d === 1 ? "day" : "days"} after you add someone, add a task to follow up with them.`,
    days: [1, 3, 7, 14],
    defaultDays: 3,
  },
  {
    kind: "birthday",
    title: "Birthdays",
    describe: (d) => (d === 0 ? "On someone's birthday, add a task to wish them a happy birthday." : `${d} days before someone's birthday, add a task to reach out.`),
    days: [0, 1, 3, 7],
    defaultDays: 0,
  },
];

export const DAILY_CAP = 15;

/** Today at midnight in the user's time zone (how all-day tasks are stored). */
const TODAY_LOCAL = `(date_trunc('day', now() at time zone coalesce(u.timezone, 'UTC')) at time zone coalesce(u.timezone, 'UTC'))`;

/** Runs every enabled rule once. Returns how many tasks were created. Never throws. */
export async function runAutomations(): Promise<number> {
  let made = 0;
  const steps: { kind: AutomationKind; candidates: string; title: string; ref: string }[] = [
    {
      kind: "quiet",
      // People they own, active, with no activity for the rule's days; one task per quiet spell.
      candidates: `p.status is distinct from 'inactive' and p.status is distinct from 'alumni' and p.exited_on is null
                   and p.last_activity_at < now() - make_interval(days => r.days)`,
      title: `'Check in with ' || p.display_name || ' (no activity in ' || r.days || ' days)'`,
      ref: `to_char(p.last_activity_at, 'YYYY-MM-DD')`,
    },
    {
      kind: "new_person",
      // Only people added after the rule was turned on.
      candidates: `p.created_at >= r.created_at and p.created_at <= now() - make_interval(days => r.days)`,
      title: `'Follow up with ' || p.display_name || ' (added ' || r.days || case when r.days = 1 then ' day ago)' else ' days ago)' end`,
      ref: `'added'`,
    },
    {
      kind: "birthday",
      candidates: `p.birthday is not null
                   and to_char(p.birthday, 'MM-DD') = to_char((now() at time zone coalesce(u.timezone, 'UTC')) + make_interval(days => r.days), 'MM-DD')`,
      title: `case when r.days = 0 then 'Wish ' || p.display_name || ' a happy birthday' else p.display_name || '''s birthday is in ' || r.days || ' days' end`,
      ref: `to_char((now() at time zone coalesce(u.timezone, 'UTC')) + make_interval(days => r.days), 'YYYY')`,
    },
  ];
  for (const s of steps) {
    try {
      const rows = await query<{ n: number }>(
        `with picked as (
           select r.user_id, p.id as person_id, ${s.ref} as ref, ${s.title} as title, ${TODAY_LOCAL} as due
             from automation_rules r
             join users u on u.id = r.user_id and u.suspended_at is null
             join people p on p.user_id = r.user_id and p.deleted_at is null and not p.is_sample
            where r.kind = $1 and r.enabled and p.exited_on is null and ${s.candidates}
              and not exists (select 1 from automation_runs ar where ar.user_id = r.user_id and ar.kind = $1 and ar.person_id = p.id and ar.ref = ${s.ref})
              and (select count(*) from automation_runs ar2 where ar2.user_id = r.user_id and ar2.kind = $1 and ar2.created_at > now() - interval '1 day') < ${DAILY_CAP}
            order by p.last_activity_at
            limit 500
         ),
         capped as (
           select * from (select picked.*, row_number() over (partition by user_id order by person_id) as rn from picked) x
            where rn <= ${DAILY_CAP}
         ),
         made as (
           insert into tasks (user_id, title, person_id, due_at)
           select user_id, left(title, 300), person_id, due from capped
           returning id, user_id, person_id
         ),
         runs as (
           insert into automation_runs (user_id, kind, person_id, ref, task_id)
           select c.user_id, $1, c.person_id, c.ref, m.id from capped c join made m using (user_id, person_id)
           on conflict do nothing
           returning 1
         )
         select count(*)::int as n from made`,
        [s.kind],
      );
      made += rows[0]?.n ?? 0;
    } catch (err) {
      console.error("[automations] rule failed", s.kind, err instanceof Error ? err.message : err);
    }
  }
  return made;
}
