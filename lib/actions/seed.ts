"use server";

import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import type { Client, List } from "@/lib/types";

/**
 * Populates demo clients/notes/tasks/a cohort list the first time the app
 * is opened with an empty database, so the dashboard isn't blank on first
 * run. No-ops for anyone who already has data.
 *
 * This writes directly via query() rather than calling the normal
 * createClientRecord/createNote/etc. actions: those call revalidatePath(),
 * which Next.js disallows when invoked synchronously during a Server
 * Component's render (as this function is, from the dashboard page) —
 * there's nothing to revalidate yet anyway since this is the first render.
 */
export async function seedDemoDataIfEmpty(): Promise<void> {
  const existing = await query(`select id from clients where user_id = $1 limit 1`, [OWNER_ID]);
  if (existing.length > 0) return;

  const insertClient = (fullName: string, currentStatus: string, nextAction: string) => {
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const lastName = rest.length > 0 ? rest.join(" ") : null;
    return queryOne<Client>(
      `insert into clients (user_id, first_name, last_name, display_name, current_status, next_action)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [OWNER_ID, firstName, lastName, fullName, currentStatus, nextAction],
    );
  };

  const logActivity = (type: string, description: string, clientId?: string | null, listId?: string | null) =>
    query(
      `insert into activity (user_id, type, description, client_id, list_id) values ($1, $2, $3, $4, $5)`,
      [OWNER_ID, type, description, clientId ?? null, listId ?? null],
    );

  const insertNote = (content: string, category: string | null, clientId: string | null) =>
    query(`insert into notes (user_id, content, category, client_id) values ($1, $2, $3, $4)`, [
      OWNER_ID,
      content,
      category,
      clientId,
    ]);

  const insertTask = (title: string, clientId: string, dueAt: string) =>
    query(`insert into tasks (user_id, title, client_id, due_at) values ($1, $2, $3, $4)`, [
      OWNER_ID,
      title,
      clientId,
      dueAt,
    ]);

  const marcus = await insertClient("Marcus Johnson", "Starts Amazon Monday", "Follow up after first week");
  const james = await insertClient("James Smith", "Guard card completed", "Apply for security positions");
  const wes = await insertClient("Wes Carter", "Interview scheduled", "Follow up after interview");
  if (!marcus || !james || !wes) return;

  await Promise.all([
    logActivity("client_created", "Marcus Johnson added", marcus.id),
    logActivity("client_created", "James Smith added", james.id),
    logActivity("client_created", "Wes Carter added", wes.id),
  ]);

  const cohort7 = await queryOne<List>(
    `insert into lists (user_id, name, is_cohort) values ($1, 'Cohort 7', true) returning *`,
    [OWNER_ID],
  );

  if (cohort7) {
    const members = [marcus, james, wes];
    for (const [index, member] of members.entries()) {
      await query(
        `insert into list_items (user_id, list_id, client_id, label, position) values ($1, $2, $3, $4, $5)`,
        [OWNER_ID, cohort7.id, member.id, member.display_name, index],
      );
    }
    await logActivity("list_created", 'List "Cohort 7" created', null, cohort7.id);
    await Promise.all(
      members.map((m) => logActivity("added_to_list", "Added to Cohort 7", m.id, cohort7.id)),
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
