"use server";

import { query } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import type { Activity, ActivityType } from "@/lib/types";

interface LogActivityParams {
  type: ActivityType;
  description: string;
  clientId?: string | null;
  listId?: string | null;
  taskId?: string | null;
  noteId?: string | null;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  await query(
    `insert into activity (user_id, type, description, client_id, list_id, task_id, note_id)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      OWNER_ID,
      params.type,
      params.description,
      params.clientId ?? null,
      params.listId ?? null,
      params.taskId ?? null,
      params.noteId ?? null,
    ],
  );
}

export async function getClientTimeline(clientId: string): Promise<Activity[]> {
  return query<Activity>(
    `select * from activity where user_id = $1 and client_id = $2 order by created_at desc`,
    [OWNER_ID, clientId],
  );
}
