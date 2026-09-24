"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { truncate } from "./helpers";
import { logActivity } from "./activity";
import { touchClientActivity } from "./clients";
import { regenerateClientSummary } from "./summary";
import { createNoteSchema, validate, toActionResult, type ActionResult } from "@/lib/validation";
import type { Note } from "@/lib/types";

export async function createNote(params: {
  content: string;
  clientId?: string | null;
  category?: string | null;
  aiMetadata?: Record<string, unknown> | null;
}): Promise<Note> {
  params = validate(createNoteSchema, params);
  const note = await queryOne<Note>(
    `insert into notes (user_id, content, client_id, category, ai_metadata)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [
      OWNER_ID,
      params.content,
      params.clientId ?? null,
      params.category ?? null,
      params.aiMetadata ? JSON.stringify(params.aiMetadata) : null,
    ],
  );

  if (!note) throw new Error("Failed to create note");

  await logActivity({
    type: "note_added",
    description: `Note: ${truncate(params.content)}`,
    clientId: params.clientId ?? null,
    noteId: note.id,
  });

  if (params.clientId) {
    await touchClientActivity(params.clientId);
    await regenerateClientSummary(params.clientId);
  }

  revalidatePath("/");
  revalidatePath("/notes");
  if (params.clientId) revalidatePath(`/clients/${params.clientId}`);

  return note;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function createNoteSafe(params: Parameters<typeof createNote>[0]): Promise<ActionResult<Note>> {
  return toActionResult(() => createNote(params));
}

export async function listRecentNotes(limit = 10): Promise<Note[]> {
  return query<Note>(
    `select * from notes where user_id = $1 and deleted_at is null order by created_at desc limit $2`,
    [OWNER_ID, limit],
  );
}

export async function listAllNotes(): Promise<Note[]> {
  return query<Note>(
    `select * from notes where user_id = $1 and deleted_at is null order by created_at desc limit 200`,
    [OWNER_ID],
  );
}

export async function listStandaloneNotes(): Promise<Note[]> {
  return query<Note>(
    `select * from notes where user_id = $1 and client_id is null and deleted_at is null order by created_at desc`,
    [OWNER_ID],
  );
}

export async function listNotesForClient(clientId: string): Promise<Note[]> {
  return query<Note>(
    `select * from notes where user_id = $1 and client_id = $2 and deleted_at is null order by created_at desc`,
    [OWNER_ID, clientId],
  );
}

/** Soft-deletes a note — the row stays in the database (recoverable) but disappears from every view. */
export async function deleteNote(id: string): Promise<void> {
  await query(
    `update notes set deleted_at = now() where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, id],
  );
  revalidatePath("/notes");
  revalidatePath("/");
}

export async function searchNotes(searchQuery: string): Promise<Note[]> {
  return query<Note>(
    `select * from notes
     where user_id = $1
       and deleted_at is null
       and search_vector @@ plainto_tsquery('english', $2)
     order by ts_rank(search_vector, plainto_tsquery('english', $2)) desc
     limit 20`,
    [OWNER_ID, searchQuery],
  );
}
