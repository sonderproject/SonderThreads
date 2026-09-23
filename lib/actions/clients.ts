"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "./helpers";
import { logActivity } from "./activity";
import type { Client } from "@/lib/types";

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName };
}

export async function listClients(): Promise<Client[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getClient(id: string): Promise<Client | null> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createClientRecord(params: {
  fullName: string;
  currentStatus?: string | null;
  nextAction?: string | null;
}): Promise<Client> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { firstName, lastName } = splitName(params.fullName);

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      display_name: params.fullName.trim(),
      current_status: params.currentStatus ?? null,
      next_action: params.nextAction ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await logActivity({
    type: "client_created",
    description: `${data.display_name} added`,
    clientId: data.id,
  });

  revalidatePath("/clients");
  revalidatePath("/");
  return data;
}

/** Finds a client by loose name match, or creates one if none exists. */
export async function findOrCreateClientByName(
  fullName: string,
): Promise<{ client: Client; created: boolean }> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const norm = fullName.trim().toLowerCase();

  const { data: existing, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;

  const match = (existing ?? []).find(
    (c) =>
      c.display_name.toLowerCase() === norm ||
      c.first_name.toLowerCase() === norm ||
      c.display_name.toLowerCase().startsWith(norm),
  );

  if (match) return { client: match, created: false };

  const created = await createClientRecord({ fullName });
  return { client: created, created: true };
}

/** Finds a client by loose name match without creating one. */
export async function findClientByName(fullName: string): Promise<Client | null> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const norm = fullName.trim().toLowerCase();

  const { data: existing, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;

  return (
    (existing ?? []).find(
      (c) =>
        c.display_name.toLowerCase() === norm ||
        c.first_name.toLowerCase() === norm ||
        c.display_name.toLowerCase().startsWith(norm),
    ) ?? null
  );
}

export async function updateClient(
  id: string,
  patch: Partial<Pick<Client, "current_status" | "next_action" | "status" | "phone" | "email" | "birthday" | "display_name">>,
): Promise<Client> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const before = await getClient(id);

  const { data, error } = await supabase
    .from("clients")
    .update({ ...patch, last_activity_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  if (before && patch.current_status !== undefined && before.current_status !== patch.current_status) {
    await logActivity({
      type: "status_changed",
      description: `Current status updated: ${patch.current_status}`,
      clientId: id,
    });
  }

  if (before && patch.next_action !== undefined && before.next_action !== patch.next_action) {
    await logActivity({
      type: "status_changed",
      description: `Next action updated: ${patch.next_action}`,
      clientId: id,
    });
  }

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  revalidatePath("/");
  return data;
}

export async function touchClientActivity(id: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase
    .from("clients")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
}

export async function searchClients(query: string): Promise<Client[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .or(
      `display_name.ilike.%${query}%,current_status.ilike.%${query}%,next_action.ilike.%${query}%,summary.ilike.%${query}%`,
    )
    .order("last_activity_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

/** Clients needing attention: overdue tasks, no recent activity, or flagged for follow-up. */
export async function getClientsNeedingAttention(): Promise<Client[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 7);

  const { data: overdueTasks } = await supabase
    .from("tasks")
    .select("client_id")
    .eq("user_id", userId)
    .eq("completed", false)
    .not("client_id", "is", null)
    .lt("due_at", new Date().toISOString());

  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .or(`needs_followup.eq.true,last_activity_at.lt.${staleThreshold.toISOString()}`)
    .order("last_activity_at", { ascending: true })
    .limit(10);

  if (error) throw error;

  const overdueIds = new Set((overdueTasks ?? []).map((t) => t.client_id));
  const byId = new Map((clients ?? []).map((c) => [c.id, c]));

  for (const id of overdueIds) {
    if (id && !byId.has(id)) {
      const { data: c } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (c) byId.set(c.id, c);
    }
  }

  return Array.from(byId.values()).slice(0, 10);
}
