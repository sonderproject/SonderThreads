"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId, truncate } from "./helpers";
import { logActivity } from "./activity";
import { touchClientActivity } from "./clients";
import { regenerateClientSummary } from "./summary";
import type { Note } from "@/lib/types";

export async function createNote(params: {
  content: string;
  clientId?: string | null;
  category?: string | null;
  aiMetadata?: Record<string, unknown> | null;
}): Promise<Note> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      content: params.content,
      client_id: params.clientId ?? null,
      category: params.category ?? null,
      ai_metadata: params.aiMetadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await logActivity({
    type: "note_added",
    description: params.clientId ? `Note: ${truncate(params.content)}` : `Note: ${truncate(params.content)}`,
    clientId: params.clientId ?? null,
    noteId: data.id,
  });

  if (params.clientId) {
    await touchClientActivity(params.clientId);
    await regenerateClientSummary(params.clientId);
  }

  revalidatePath("/");
  revalidatePath("/notes");
  if (params.clientId) revalidatePath(`/clients/${params.clientId}`);

  return data;
}

export async function listRecentNotes(limit = 10): Promise<Note[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function listAllNotes(): Promise<Note[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

export async function listStandaloneNotes(): Promise<Note[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .is("client_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listNotesForClient(clientId: string): Promise<Note[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function deleteNote(id: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase.from("notes").delete().eq("user_id", userId).eq("id", id);
  revalidatePath("/notes");
  revalidatePath("/");
}

export async function searchNotes(query: string): Promise<Note[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .ilike("content", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
