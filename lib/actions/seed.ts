"use server";

import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import type { Person, List } from "@/lib/types";

/**
 * Populates demo people/notes/tasks/a group list the first time the app
 * is opened with an empty database, so the dashboard isn't blank on first
 * run. No-ops for anyone who already has data.
 *
 * This writes directly via query() rather than calling the normal
 * createPersonRecord/createNote/etc. actions: those call revalidatePath(),
 * which Next.js disallows when invoked synchronously during a Server
 * Component's render (as this function is, from the dashboard page) —
 * there's nothing to revalidate yet anyway since this is the first render.
 */
export async function seedDemoDataIfEmpty(): Promise<void> {
  const existing = await query(`select id from people where user_id = $1 limit 1`, [OWNER_ID]);
  if (existing.length > 0) return;

  const insertPerson = (fullName: string, currentStatus: string, nextAction: string) => {
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const lastName = rest.length > 0 ? rest.join(" ") : null;
    return queryOne<Person>(
      `insert into people (user_id, first_name, last_name, display_name, current_status, next_action)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [OWNER_ID, firstName, lastName, fullName, currentStatus, nextAction],
    );
  };

  const logActivity = (type: string, description: string, personId?: string | null, listId?: string | null) =>
    query(
      `insert into activity (user_id, type, description, person_id, list_id) values ($1, $2, $3, $4, $5)`,
      [OWNER_ID, type, description, personId ?? null, listId ?? null],
    );

  const insertNote = (content: string, category: string | null, personId: string | null) =>
    query(`insert into notes (user_id, content, category, person_id) values ($1, $2, $3, $4)`, [
      OWNER_ID,
      content,
      category,
      personId,
    ]);

  const insertTask = (title: string, personId: string, dueAt: string) =>
    query(`insert into tasks (user_id, title, person_id, due_at) values ($1, $2, $3, $4)`, [
      OWNER_ID,
      title,
      personId,
      dueAt,
    ]);

  const marcus = await insertPerson("Marcus Johnson", "Starts Amazon Monday", "Follow up after first week");
  const james = await insertPerson("James Smith", "Guard card completed", "Apply for security positions");
  const wes = await insertPerson("Wes Carter", "Interview scheduled", "Follow up after interview");
  if (!marcus || !james || !wes) return;

  await Promise.all([
    logActivity("person_created", "Marcus Johnson added", marcus.id),
    logActivity("person_created", "James Smith added", james.id),
    logActivity("person_created", "Wes Carter added", wes.id),
  ]);

  const group7 = await queryOne<List>(
    `insert into lists (user_id, name, is_group) values ($1, 'Group 7', true) returning *`,
    [OWNER_ID],
  );

  if (group7) {
    const members = [marcus, james, wes];
    for (const [index, member] of members.entries()) {
      await query(
        `insert into list_items (user_id, list_id, person_id, label, position) values ($1, $2, $3, $4, $5)`,
        [OWNER_ID, group7.id, member.id, member.display_name, index],
      );
    }
    await logActivity("list_created", 'List "Group 7" created', null, group7.id);
    await Promise.all(
      members.map((m) => logActivity("added_to_list", "Added to Group 7", m.id, group7.id)),
    );
  }

  await Promise.all([
    insertNote("Marcus said he starts Amazon Monday.", "employment", marcus.id),
    insertNote("James got his guard card today.", "certification", james.id),
    insertNote("Wes has an interview scheduled — prepping his resume.", "employment", wes.id),
    insertNote("Need to ask supervisor about transportation cards.", null, null),
  ]);

  await Promise.all([
    logActivity("note_added", "Note: Marcus said he starts Amazon Monday.", marcus.id),
    logActivity("note_added", "Note: James got his guard card today.", james.id),
    logActivity("note_added", "Note: Wes has an interview scheduled — prepping his resume.", wes.id),
  ]);

  const todayNoon = new Date();
  todayNoon.setHours(12, 0, 0, 0);
  const dueAt = todayNoon.toISOString();

  await Promise.all([
    insertTask("Call Marcus about interview", marcus.id, dueAt),
    insertTask("Send James onboarding paperwork", james.id, dueAt),
    insertTask("Check Wes certification", wes.id, dueAt),
  ]);

  await Promise.all([
    logActivity("task_created", "Task: Call Marcus about interview", marcus.id),
    logActivity("task_created", "Task: Send James onboarding paperwork", james.id),
    logActivity("task_created", "Task: Check Wes certification", wes.id),
  ]);
}
