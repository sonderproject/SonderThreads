"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { truncate } from "./helpers";
import { logActivity } from "./activity";
import { touchPersonActivity } from "./people";
import { regeneratePersonSummary } from "./summary";
import {
  createNoteSchema,
  updateNoteSchema,
  validate,
  toActionResult,
  type ActionResult,
} from "@/lib/validation";
import type { Note } from "@/lib/types";

export async function createNote(params: {
  content: string;
  personId?: string | null;
  category?: string | null;
  aiMetadata?: Record<string, unknown> | null;
}): Promise<Note> {
  const userId = await requireUserId();
  params = validate(createNoteSchema, params);
  const note = await queryOne<Note>(
    `insert into notes (user_id, content, person_id, category, ai_metadata)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [
      userId,
      params.content,
      params.personId ?? null,
      params.category ?? null,
      params.aiMetadata ? JSON.stringify(params.aiMetadata) : null,
    ],
  );

  if (!note) throw new Error("Failed to create note");

  await logActivity({
    type: "note_added",
    description: `Note: ${truncate(params.content)}`,
    personId: params.personId ?? null,
    noteId: note.id,
  });

  if (params.personId) {
    await touchPersonActivity(params.personId);
    await regeneratePersonSummary(params.personId);
  }

  revalidatePath("/");
  revalidatePath("/notes");
  if (params.personId) revalidatePath(`/people/${params.personId}`);

  return note;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function createNoteSafe(params: Parameters<typeof createNote>[0]): Promise<ActionResult<Note>> {
  return toActionResult(() => createNote(params));
}

export async function listRecentNotes(limit = 10): Promise<Note[]> {
  const userId = await requireUserId();
  return query<Note>(
    `select * from notes where user_id = $1 and deleted_at is null order by created_at desc limit $2`,
    [userId, limit],
  );
}

export async function listAllNotes(): Promise<Note[]> {
  const userId = await requireUserId();
  return query<Note>(
    `select * from notes where user_id = $1 and deleted_at is null order by created_at desc limit 200`,
    [userId],
  );
}

export async function listStandaloneNotes(): Promise<Note[]> {
  const userId = await requireUserId();
  return query<Note>(
    `select * from notes where user_id = $1 and person_id is null and deleted_at is null order by created_at desc`,
    [userId],
  );
}

export async function listNotesForPerson(personId: string): Promise<Note[]> {
  const userId = await requireUserId();
  return query<Note>(
    `select * from notes where user_id = $1 and person_id = $2 and deleted_at is null order by created_at desc`,
    [userId, personId],
  );
}

export async function updateNote(id: string, content: string): Promise<Note> {
  const userId = await requireUserId();
  const params = validate(updateNoteSchema, { content });
  const note = await queryOne<Note>(
    `update notes set content = $1 where user_id = $2 and id = $3 and deleted_at is null returning *`,
    [params.content, userId, id],
  );

  if (!note) throw new Error("Note not found");

  revalidatePath("/notes");
  revalidatePath("/");
  if (note.person_id) revalidatePath(`/people/${note.person_id}`);

  return note;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function updateNoteSafe(id: string, content: string): Promise<ActionResult<Note>> {
  return toActionResult(() => updateNote(id, content));
}

/** Soft-deletes a note — the row stays in the database (recoverable) but disappears from every view. */
export async function deleteNote(id: string): Promise<void> {
  await setNoteDeleted(id, true);
}

/** Undoes deleteNote(). */
export async function restoreNote(id: string): Promise<void> {
  await setNoteDeleted(id, false);
}

async function setNoteDeleted(id: string, deleted: boolean): Promise<void> {
  const userId = await requireUserId();
  const note = await queryOne<Note>(
    `update notes set deleted_at = ${deleted ? "now()" : "null"}
     where user_id = $1 and id = $2 and deleted_at is ${deleted ? "null" : "not null"}
     returning *`,
    [userId, id],
  );
  revalidatePath("/notes");
  revalidatePath("/");
  if (note?.person_id) revalidatePath(`/people/${note.person_id}`);
}

export async function searchNotes(searchQuery: string): Promise<Note[]> {
  const userId = await requireUserId();
  return query<Note>(
    `select * from notes
     where user_id = $1
       and deleted_at is null
       and search_vector @@ plainto_tsquery('english', $2)
     order by ts_rank(search_vector, plainto_tsquery('english', $2)) desc
     limit 20`,
    [userId, searchQuery],
  );
}
