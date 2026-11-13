"use server";

// Tasks are private to the member who created them, organization tasks included:
// every query here is scoped to the signed-in user (user_id), never the organization.

import { assertCanWrite } from "@/lib/billing";
import { revalidatePath } from "next/cache";
import { actorQuery, actorQueryOne } from "@/lib/db/scope";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { logActivity } from "./activity";
import { touchPersonActivity } from "./people";
import { nextDueDate } from "@/lib/recurrence";
import {
  createTaskSchema,
  updateTaskSchema,
  validate,
  toActionResult,
  type ActionResult,
} from "@/lib/validation";
import type { Task, TaskRecurrence } from "@/lib/types";
import { fuzzyFilter } from "@/lib/fuzzy";

export async function listTasks(): Promise<Task[]> {
  const userId = await requireUserId();
  return query<Task>(
    `select * from tasks where user_id = $1 and deleted_at is null order by due_at asc nulls last`,
    [userId],
  );
}

export async function listTasksForPerson(personId: string): Promise<Task[]> {
  const userId = await requireUserId();
  return query<Task>(
    `select * from tasks
     where user_id = $1 and person_id = $2 and deleted_at is null
     order by completed asc, due_at asc nulls last`,
    [userId, personId],
  );
}

export async function createTask(params: {
  title: string;
  personId?: string | null;
  listId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  recurrence?: TaskRecurrence | null;
  /** The note this task was pulled out of, if any. */
  sourceNoteId?: string | null;
}): Promise<Task> {
  const userId = await requireUserId();
  await assertCanWrite();
  params = validate(createTaskSchema, params);
  const task = await queryOne<Task>(
    `insert into tasks (user_id, title, person_id, list_id, due_at, notes, recurrence, source_note_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [
      userId,
      params.title.trim(),
      params.personId ?? null,
      params.listId ?? null,
      params.dueAt ?? null,
      params.notes ?? null,
      params.recurrence ?? null,
      params.sourceNoteId ?? null,
    ],
  );

  if (!task) throw new Error("Failed to create task");

  await logActivity({
    type: "task_created",
    description: `Task: ${task.title}`,
    personId: params.personId ?? null,
    taskId: task.id,
  });

  if (params.personId) await touchPersonActivity(params.personId);

  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  if (params.personId) revalidatePath(`/people/${params.personId}`);

  return task;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function createTaskSafe(params: Parameters<typeof createTask>[0]): Promise<ActionResult<Task>> {
  return toActionResult(() => createTask(params));
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  const userId = await requireUserId();
  await assertCanWrite();
  const task = await actorQueryOne<Task>(userId, 
    `update tasks set completed = $1, completed_at = $2
     where user_id = $3 and id = $4 and deleted_at is null
     returning *`,
    [completed, completed ? new Date().toISOString() : null, userId, id],
  );

  if (!task) throw new Error("Task not found");

  if (completed) {
    await Promise.all([
      logActivity({
        type: "task_completed",
        description: `Task completed: ${task.title}`,
        personId: task.person_id,
        taskId: task.id,
      }),
      task.person_id ? touchPersonActivity(task.person_id) : null,
      task.recurrence ? spawnNextOccurrence(task) : null,
    ]);
  } else if (task.recurrence) {
    // Un-completing means the next occurrence isn't due after all — drop it
    // unless it's already been worked on.
    await actorQuery(userId, 
      `update tasks set deleted_at = now()
       where user_id = $1 and recurs_from = $2 and completed = false and deleted_at is null`,
      [userId, task.id],
    );
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  if (task.person_id) revalidatePath(`/people/${task.person_id}`);
}

/**
 * Creates the next occurrence of a recurring task. Keyed on recurs_from so
 * un-checking and re-checking the same task doesn't stack up duplicates.
 */
async function spawnNextOccurrence(task: Task): Promise<void> {
  const userId = await requireUserId();
  if (!task.recurrence) return;

  const existing = await queryOne<{ id: string }>(
    `select id from tasks where user_id = $1 and recurs_from = $2 and deleted_at is null limit 1`,
    [userId, task.id],
  );
  if (existing) return;

  await query(
    `insert into tasks (user_id, title, notes, person_id, list_id, due_at, recurrence, recurs_from)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      task.title,
      task.notes,
      task.person_id,
      task.list_id,
      nextDueDate(task.due_at, task.recurrence).toISOString(),
      task.recurrence,
      task.id,
    ],
  );
}

/** Soft-deletes a task — the row stays in the database (recoverable) but disappears from every view. */
export async function deleteTask(id: string): Promise<void> {
  await setTaskDeleted(id, true);
}

/** Undoes deleteTask(). */
export async function restoreTask(id: string): Promise<void> {
  await setTaskDeleted(id, false);
}

/** Soft-deletes several tasks at once (Tasks tab → Select → Delete). */
export async function deleteTasks(ids: string[]): Promise<void> {
  await setTasksDeleted(ids, true);
}

/** Undoes deleteTasks(). */
export async function restoreTasks(ids: string[]): Promise<void> {
  await setTasksDeleted(ids, false);
}

async function setTasksDeleted(ids: string[], deleted: boolean): Promise<void> {
  const userId = await requireUserId();
  await assertCanWrite();
  if (ids.length === 0) return;
  await actorQuery(userId, 
    `update tasks set deleted_at = ${deleted ? "now()" : "null"}
     where user_id = $1 and id = any($2::uuid[]) and deleted_at is ${deleted ? "null" : "not null"}`,
    [userId, ids],
  );
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/notifications");
}

async function setTaskDeleted(id: string, deleted: boolean): Promise<void> {
  const userId = await requireUserId();
  await assertCanWrite();
  const task = await actorQueryOne<Task>(userId, 
    `update tasks set deleted_at = ${deleted ? "now()" : "null"}
     where user_id = $1 and id = $2 and deleted_at is ${deleted ? "null" : "not null"}
     returning *`,
    [userId, id],
  );
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  if (task?.person_id) revalidatePath(`/people/${task.person_id}`);
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "due_at" | "notes" | "person_id" | "list_id" | "recurrence">>,
): Promise<Task> {
  const userId = await requireUserId();
  await assertCanWrite();
  patch = validate(updateTaskSchema, patch);
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) {
    const task = await actorQueryOne<Task>(userId, `select * from tasks where user_id = $1 and id = $2`, [
      userId,
      id,
    ]);
    if (!task) throw new Error("Task not found");
    return task;
  }

  const setClauses = fields.map((field, i) => `${field} = $${i + 3}`);
  // A new due date gets its own push/text reminder.
  if (fields.includes("due_at")) setClauses.push("reminded_at = null");
  const values = fields.map((field) => patch[field]);

  const task = await actorQueryOne<Task>(userId, 
    `update tasks set ${setClauses.join(", ")}
     where user_id = $1 and id = $2 and deleted_at is null
     returning *`,
    [userId, id, ...values],
  );

  if (!task) throw new Error("Task not found");

  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  if (task.person_id) revalidatePath(`/people/${task.person_id}`);

  return task;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function updateTaskSafe(
  id: string,
  patch: Parameters<typeof updateTask>[1],
): Promise<ActionResult<Task>> {
  return toActionResult(() => updateTask(id, patch));
}

export async function searchTasks(searchQuery: string): Promise<Task[]> {
  const userId = await requireUserId();
  // Typo-tolerant ranking in JS over open tasks plus the most recent completed ones.
  const tasks = await query<Task>(
    `select * from tasks
     where user_id = $1 and deleted_at is null
     order by completed asc, coalesce(due_at, created_at) desc
     limit 2000`,
    [userId],
  );
  return fuzzyFilter(tasks, searchQuery, (t) => [{ text: t.title, weight: 1 }, { text: t.notes, weight: 0.8 }], 20);
}
