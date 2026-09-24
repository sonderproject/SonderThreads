"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { generateClientSummary } from "@/lib/ai/client-summary";
import type { Client } from "@/lib/types";

/** Regenerates a client's short summary + current/next fields from their recent notes and open tasks. */
export async function regenerateClientSummary(clientId: string): Promise<void> {
  const client = await queryOne<Client>(
    `select * from clients where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, clientId],
  );

  if (!client) return;

  const notes = await query<{ content: string; created_at: string }>(
    `select content, created_at from notes
     where user_id = $1 and client_id = $2 and deleted_at is null
     order by created_at desc
     limit 5`,
    [OWNER_ID, clientId],
  );

  const tasks = await query<{ title: string; due_at: string | null }>(
    `select title, due_at from tasks
     where user_id = $1 and client_id = $2 and completed = false and deleted_at is null
     order by due_at asc nulls last
     limit 5`,
    [OWNER_ID, clientId],
  );

  const result = await generateClientSummary({
    client: {
      displayName: client.display_name,
      currentStatus: client.current_status,
      nextAction: client.next_action,
    },
    recentNotes: notes.map((n) => ({ content: n.content, createdAt: n.created_at })),
    openTasks: tasks.map((t) => ({ title: t.title, dueAt: t.due_at })),
  });

  await query(
    `update clients set summary = $1, current_status = $2, next_action = $3
     where user_id = $4 and id = $5 and deleted_at is null`,
    [
      result.summary || client.summary,
      result.currentStatus ?? client.current_status,
      result.nextAction ?? client.next_action,
      OWNER_ID,
      clientId,
    ],
  );

  if (result.summary) {
    await query(
      `insert into client_summaries (user_id, client_id, summary, generated_by) values ($1, $2, $3, $4)`,
      [OWNER_ID, clientId, result.summary, result.generatedBy],
    );
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/");
}
