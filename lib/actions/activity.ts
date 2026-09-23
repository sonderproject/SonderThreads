"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "./helpers";
import type { ActivityType } from "@/lib/types";

interface LogActivityParams {
  type: ActivityType;
  description: string;
  clientId?: string | null;
  listId?: string | null;
  taskId?: string | null;
  noteId?: string | null;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase.from("activity").insert({
    user_id: userId,
    type: params.type,
    description: params.description,
    client_id: params.clientId ?? null,
    list_id: params.listId ?? null,
    task_id: params.taskId ?? null,
    note_id: params.noteId ?? null,
  });
}

export async function getClientTimeline(clientId: string) {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity")
    .select("*")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
