"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
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

export async function listTasks(): Promise<Task[]> {
  return query<Task>(
    `select * from tasks where user_id = $1 and deleted_at is null order by due_at asc nulls last`,
    [OWNER_ID],
  );
}

export async function listTasksForPerson(personId: string): Promise<Task[]> {
  return query<Task>(
    `select * from tasks
     where user_id = $1 and person_id = $2 and deleted_at is null
     order by completed asc, due_at asc nulls last`,
    [OWNER_ID, personId],
  );
}

export async function createTask(params: {
  title: string;
  personId?: string | null;
  listId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  recurrence?: TaskRecurrence | null;
}): Promise<Task> {
  params = validate(createTaskSchema, params);
  const task = await queryOne<Task>(
    `insert into tasks (user_id, title, person_id, list_id, due_at, notes, recurrence)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      OWNER_ID,
      params.title.trim(),
      params.personId ?? null,
      params.listId ?? null,
      params.dueAt ?? null,
      params.notes ?? null,
      params.recurrence ?? null,
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
  const task = await queryOne<Task>(
    `update tasks set completed = $1, completed_at = $2
     where user_id = $3 and id = $4 and deleted_at is null
     returning *`,
    [completed, completed ? new Date().toISOString() : null, OWNER_ID, id],
  );

  if (!task) throw new Error("Task not found");

  if (completed) {
    await logActivity({
      type: "task_completed",
      description: `Task completed: ${task.title}`,
      personId: task.person_id,
      taskId: task.id,
    });
    if (task.person_id) await touchPersonActivity(task.person_id);
    if (task.recurrence) await spawnNextOccurrence(task);
  } else if (task.recurrence) {
    // Un-completing means the next occurrence isn't due after all — drop it
    // unless it's already been worked on.
    await query(
      `update tasks set deleted_at = now()
       where user_id = $1 and recurs_from = $2 and completed = false and deleted_at is null`,
      [OWNER_ID, task.id],
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
  if (!task.recurrence) return;

  const existing = await queryOne<{ id: string }>(
    `select id from tasks where user_id = $1 and recurs_from = $2 and deleted_at is null limit 1`,
    [OWNER_ID, task.id],
  );
  if (existing) return;

  await query(
    `insert into tasks (user_id, title, notes, person_id, list_id, due_at, recurrence, recurs_from)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      OWNER_ID,
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

async function setTaskDeleted(id: string, deleted: boolean): Promise<void> {
  const task = await queryOne<Task>(
    `update tasks set deleted_at = ${deleted ? "now()" : "null"}
     where user_id = $1 and id = $2 and deleted_at is ${deleted ? "null" : "not null"}
     returning *`,
    [OWNER_ID, id],
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
  patch = validate(updateTaskSchema, patch);
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) {
    const task = await queryOne<Task>(`select * from tasks where user_id = $1 and id = $2`, [
      OWNER_ID,
      id,
    ]);
    if (!task) throw new Error("Task not found");
    return task;
  }

  const setClauses = fields.map((field, i) => `${field} = $${i + 3}`);
  const values = fields.map((field) => patch[field]);

  const task = await queryOne<Task>(
    `update tasks set ${setClauses.join(", ")}
     where user_id = $1 and id = $2 and deleted_at is null
     returning *`,
    [OWNER_ID, id, ...values],
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
  return query<Task>(
    `select * from tasks
     where user_id = $1
       and deleted_at is null
       and search_vector @@ plainto_tsquery('english', $2)
     order by ts_rank(search_vector, plainto_tsquery('english', $2)) desc
     limit 20`,
    [OWNER_ID, searchQuery],
  );
}
