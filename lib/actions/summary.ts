"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "./helpers";
import { generateClientSummary } from "@/lib/ai/client-summary";

/** Regenerates a client's short summary + current/next fields from their recent notes and open tasks. */
export async function regenerateClientSummary(clientId: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return;

  const { data: notes } = await supabase
    .from("notes")
    .select("content, created_at")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, due_at")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("completed", false)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(5);

  const result = await generateClientSummary({
    client: {
      displayName: client.display_name,
      currentStatus: client.current_status,
      nextAction: client.next_action,
    },
    recentNotes: (notes ?? []).map((n) => ({ content: n.content, createdAt: n.created_at })),
    openTasks: (tasks ?? []).map((t) => ({ title: t.title, dueAt: t.due_at })),
  });

  await supabase
    .from("clients")
    .update({
      summary: result.summary || client.summary,
      current_status: result.currentStatus ?? client.current_status,
      next_action: result.nextAction ?? client.next_action,
    })
    .eq("user_id", userId)
    .eq("id", clientId);

  if (result.summary) {
    await supabase.from("client_summaries").insert({
      user_id: userId,
      client_id: clientId,
      summary: result.summary,
      generated_by: result.generatedBy,
    });
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/");
}
