"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { logActivity } from "./activity";
import type { Task } from "@/lib/types";

export async function listTasks(): Promise<Task[]> {
  return query<Task>(`select * from tasks where user_id = $1 order by due_at asc nulls last`, [
    OWNER_ID,
  ]);
}

export async function listTasksForClient(clientId: string): Promise<Task[]> {
  return query<Task>(
    `select * from tasks
     where user_id = $1 and client_id = $2
     order by completed asc, due_at asc nulls last`,
    [OWNER_ID, clientId],
  );
}

export async function createTask(params: {
  title: string;
  clientId?: string | null;
  listId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
}): Promise<Task> {
  const task = await queryOne<Task>(
    `insert into tasks (user_id, title, client_id, list_id, due_at, notes)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      OWNER_ID,
      params.title.trim(),
      params.clientId ?? null,
      params.listId ?? null,
      params.dueAt ?? null,
      params.notes ?? null,
    ],
  );

  if (!task) throw new Error("Failed to create task");

  await logActivity({
    type: "task_created",
    description: `Task: ${task.title}`,
    clientId: params.clientId ?? null,
    taskId: task.id,
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  if (params.clientId) revalidatePath(`/clients/${params.clientId}`);

  return task;
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  const task = await queryOne<Task>(
    `update tasks set completed = $1, completed_at = $2 where user_id = $3 and id = $4 returning *`,
    [completed, completed ? new Date().toISOString() : null, OWNER_ID, id],
  );

  if (!task) throw new Error("Task not found");

  if (completed) {
    await logActivity({
      type: "task_completed",
      description: `Task completed: ${task.title}`,
      clientId: task.client_id,
      taskId: task.id,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  if (task.client_id) revalidatePath(`/clients/${task.client_id}`);
}

export async function deleteTask(id: string): Promise<void> {
  await query(`delete from tasks where user_id = $1 and id = $2`, [OWNER_ID, id]);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "due_at" | "notes" | "client_id" | "list_id">>,
): Promise<void> {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;

  const setClauses = fields.map((field, i) => `${field} = $${i + 3}`);
  const values = fields.map((field) => patch[field]);

  await query(`update tasks set ${setClauses.join(", ")} where user_id = $1 and id = $2`, [
    OWNER_ID,
    id,
    ...values,
  ]);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function searchTasks(searchQuery: string): Promise<Task[]> {
  return query<Task>(
    `select * from tasks
     where user_id = $1 and (title ilike $2 or notes ilike $2)
     order by due_at asc nulls last
     limit 20`,
    [OWNER_ID, `%${searchQuery}%`],
  );
}
