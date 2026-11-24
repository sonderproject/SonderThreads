import { query } from "@/lib/db/client";
import type { Activity, CheckIn, Person, List, ListItem, Note, Task } from "@/lib/types";

/**
 * The full backup of one person's records (Settings → Data → backup), used by the
 * download (app/api/export) and the restore test. Plain server module: callers pass the
 * id from getSessionUser()/requireUserId().
 */
export const BACKUP_COLUMNS = {
  people:
    "id, first_name, last_name, display_name, phone, email, birthday, gender, ethnicity, income_level, status, current_status, next_action, summary, needs_followup, client_since, exited_on, custom_fields, created_at, updated_at, last_activity_at",
  notes: "id, person_id, content, category, created_at, updated_at",
  lists: "id, name, description, is_group, created_at, updated_at",
  list_items: "id, list_id, person_id, label, note, checked, position, created_at, updated_at",
  tasks: "id, title, notes, person_id, list_id, due_at, recurrence, completed, completed_at, created_at, updated_at",
  activity: "id, person_id, list_id, task_id, note_id, type, description, created_at",
  check_ins: "id, person_id, checked_in_at, reason, amount_cents, created_at, updated_at",
};

export async function buildBackup(userId: string) {
  const [people, notes, lists, listItems, tasks, activity, checkIns, outcomes, exits] = await Promise.all([
    query<Person>(`select ${BACKUP_COLUMNS.people} from people where user_id = $1 and deleted_at is null order by display_name`, [userId]),
    query<Note>(`select ${BACKUP_COLUMNS.notes} from notes where user_id = $1 and deleted_at is null order by created_at`, [userId]),
    query<List>(`select ${BACKUP_COLUMNS.lists} from lists where user_id = $1 and deleted_at is null order by name`, [userId]),
    query<ListItem>(`select ${BACKUP_COLUMNS.list_items} from list_items where user_id = $1 order by list_id, position`, [userId]),
    query<Task>(`select ${BACKUP_COLUMNS.tasks} from tasks where user_id = $1 and deleted_at is null order by due_at nulls last`, [userId]),
    query<Activity>(`select ${BACKUP_COLUMNS.activity} from activity where user_id = $1 order by created_at`, [userId]),
    query<CheckIn>(`select ${BACKUP_COLUMNS.check_ins} from check_ins where user_id = $1 and deleted_at is null order by checked_in_at`, [userId]),
    // Outcomes this person recorded (Settings → Outcomes), with the outcome's name.
    query<Record<string, unknown>>(
      `select po.id, po.person_id, o.name as outcome, to_char(po.achieved_on, 'YYYY-MM-DD') as achieved_on, po.note, po.created_at
         from person_outcomes po join outcomes o on o.id = po.outcome_id
        where po.user_id = $1 and po.deleted_at is null order by po.achieved_on`,
      [userId],
    ),
    // Exits this person recorded (Settings → Outcomes & exits), with the reason and its group at the time.
    query<Record<string, unknown>>(
      `select pe.id, pe.person_id, r.name as reason, pe.kind as "group", to_char(pe.exited_on, 'YYYY-MM-DD') as exited_on, pe.note,
              pe.reopened_at as came_back_at, pe.created_at
         from person_exits pe join exit_reasons r on r.id = pe.reason_id
        where pe.user_id = $1 and pe.deleted_at is null order by pe.exited_on`,
      [userId],
    ),
  ]);

  // Business setup this person made (so a restore can bring it back): custom field definitions (to match saved
  // values by name), forms with their responses, automation rules and report schedules. Restores come back off.
  const [customFields, forms, automations, reportSchedules] = await Promise.all([
    query<Record<string, unknown>>(
      `select id, label, kind, options from custom_fields
        where archived_at is null and ((org_id is null and user_id = $1) or org_id in (select org_id from memberships where user_id = $1 and active))
        order by position`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `select id, name, description, status, fields, settings, created_at from forms where user_id = $1 and deleted_at is null order by created_at`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `select id, name, enabled, trigger, conditions, actions, created_at from workflows where user_id = $1 and deleted_at is null order by created_at`,
      [userId],
    ),
    query<Record<string, unknown>>(
      `select id, name, frequency, weekday, month_day, hour, recipients, attach_pdf, tiles, enabled, created_at
         from report_schedules where user_id = $1 and deleted_at is null order by created_at`,
      [userId],
    ),
  ]);
  const formResponses = forms.length
    ? await query<Record<string, unknown>>(
        `select id, form_id, answers, fields, status, person_id, created_at from form_submissions
          where form_id = any($1::uuid[]) and deleted_at is null order by created_at`,
        [forms.map((f) => f.id)],
      )
    : [];

  return {
    people,
    notes,
    lists,
    list_items: listItems,
    tasks,
    activity,
    check_ins: checkIns,
    outcomes,
    exits,
    custom_fields: customFields,
    forms,
    form_responses: formResponses,
    automations,
    report_schedules: reportSchedules,
  };
}
