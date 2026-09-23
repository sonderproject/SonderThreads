"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "./helpers";
import { logActivity } from "./activity";
import type { Task } from "@/lib/types";

export async function listTasks(): Promise<Task[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

export async function listTasksForClient(clientId: string): Promise<Task[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("completed", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

export async function createTask(params: {
  title: string;
  clientId?: string | null;
  listId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
}): Promise<Task> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: params.title.trim(),
      client_id: params.clientId ?? null,
      list_id: params.listId ?? null,
      due_at: params.dueAt ?? null,
      notes: params.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await logActivity({
    type: "task_created",
    description: `Task: ${data.title}`,
    clientId: params.clientId ?? null,
    taskId: data.id,
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  if (params.clientId) revalidatePath(`/clients/${params.clientId}`);

  return data;
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  if (completed) {
    await logActivity({
      type: "task_completed",
      description: `Task completed: ${data.title}`,
      clientId: data.client_id,
      taskId: data.id,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  if (data.client_id) revalidatePath(`/clients/${data.client_id}`);
}

export async function deleteTask(id: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase.from("tasks").delete().eq("user_id", userId).eq("id", id);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "due_at" | "notes" | "client_id" | "list_id">>,
): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase.from("tasks").update(patch).eq("user_id", userId).eq("id", id);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function searchTasks(query: string): Promise<Task[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .or(`title.ilike.%${query}%,notes.ilike.%${query}%`)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
