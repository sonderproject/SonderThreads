"use server";

import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import type { Activity, ActivityType } from "@/lib/types";

interface LogActivityParams {
  type: ActivityType;
  description: string;
  personId?: string | null;
  listId?: string | null;
  taskId?: string | null;
  noteId?: string | null;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const userId = await requireUserId();
  await query(
    `insert into activity (user_id, type, description, person_id, list_id, task_id, note_id)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      params.type,
      params.description,
      params.personId ?? null,
      params.listId ?? null,
      params.taskId ?? null,
      params.noteId ?? null,
    ],
  );
}

export async function getPersonTimeline(personId: string): Promise<Activity[]> {
  const userId = await requireUserId();
  return query<Activity>(
    `select * from activity where user_id = $1 and person_id = $2 order by created_at desc`,
    [userId, personId],
  );
}
