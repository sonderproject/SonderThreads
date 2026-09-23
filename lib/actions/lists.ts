"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "./helpers";
import { logActivity } from "./activity";
import { findClientByName, findOrCreateClientByName, touchClientActivity } from "./clients";
import type { List, ListItem } from "@/lib/types";

export async function listLists(): Promise<List[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getListByName(name: string): Promise<List | null> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", name.trim());

  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getListWithItems(id: string): Promise<{ list: List; items: ListItem[] } | null> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (listError) throw listError;
  if (!list) return null;

  const { data: items, error: itemsError } = await supabase
    .from("list_items")
    .select("*")
    .eq("user_id", userId)
    .eq("list_id", id)
    .order("position", { ascending: true });

  if (itemsError) throw itemsError;

  return { list, items: items ?? [] };
}

export async function createList(params: {
  name: string;
  description?: string | null;
  isCohort?: boolean;
}): Promise<List> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lists")
    .insert({
      user_id: userId,
      name: params.name.trim(),
      description: params.description ?? null,
      is_cohort: params.isCohort ?? false,
    })
    .select("*")
    .single();

  if (error) throw error;

  await logActivity({
    type: "list_created",
    description: `List "${data.name}" created`,
    listId: data.id,
  });

  revalidatePath("/lists");
  revalidatePath("/");
  return data;
}

export async function findOrCreateListByName(
  name: string,
  isCohort: boolean,
): Promise<{ list: List; created: boolean }> {
  const existing = await getListByName(name);
  if (existing) return { list: existing, created: false };
  const created = await createList({ name, isCohort });
  return { list: created, created: true };
}

export async function renameList(id: string, name: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase.from("lists").update({ name: name.trim() }).eq("user_id", userId).eq("id", id);
  revalidatePath(`/lists/${id}`);
  revalidatePath("/lists");
}

export async function updateListDescription(id: string, description: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase.from("lists").update({ description }).eq("user_id", userId).eq("id", id);
  revalidatePath(`/lists/${id}`);
}

export async function deleteList(id: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase.from("lists").delete().eq("user_id", userId).eq("id", id);
  revalidatePath("/lists");
  revalidatePath("/");
}

export async function duplicateList(id: string): Promise<List> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const existing = await getListWithItems(id);
  if (!existing) throw new Error("List not found");

  const copy = await createList({
    name: `${existing.list.name} (copy)`,
    description: existing.list.description,
    isCohort: existing.list.is_cohort,
  });

  if (existing.items.length > 0) {
    await supabase.from("list_items").insert(
      existing.items.map((item, index) => ({
        user_id: userId,
        list_id: copy.id,
        client_id: item.client_id,
        label: item.label,
        checked: false,
        position: index,
      })),
    );
  }

  revalidatePath("/lists");
  return copy;
}

export async function addListItem(params: {
  listId: string;
  label: string;
  clientId?: string | null;
}): Promise<ListItem> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: existingItems } = await supabase
    .from("list_items")
    .select("position")
    .eq("user_id", userId)
    .eq("list_id", params.listId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existingItems?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("list_items")
    .insert({
      user_id: userId,
      list_id: params.listId,
      label: params.label.trim(),
      client_id: params.clientId ?? null,
      position: nextPosition,
    })
    .select("*")
    .single();

  if (error) throw error;

  revalidatePath(`/lists/${params.listId}`);
  return data;
}

/** Adds a single free-text item, auto-linking it if the label matches an existing client. */
export async function addListItemSmart(listId: string, label: string): Promise<ListItem> {
  const match = await findClientByName(label);
  return addListItem({ listId, label: match?.display_name ?? label, clientId: match?.id ?? null });
}

/**
 * Adds a set of names to a list. For cohort lists, unmatched names become new
 * client records (a cohort is a roster of clients); for plain lists, items
 * link to an existing client when the name matches but otherwise stay
 * free-text.
 */
export async function addNamesToList(
  listId: string,
  isCohort: boolean,
  names: string[],
): Promise<{ createdClients: string[]; linkedClients: string[] }> {
  const createdClients: string[] = [];
  const linkedClients: string[] = [];
  const { list } = (await getListWithItems(listId)) ?? {};

  for (const name of names) {
    if (!name.trim()) continue;

    if (isCohort) {
      const { client, created } = await findOrCreateClientByName(name);
      await addListItem({ listId, label: client.display_name, clientId: client.id });
      await touchClientActivity(client.id);
      await logActivity({
        type: "added_to_list",
        description: `Added to ${list?.name ?? "list"}`,
        clientId: client.id,
        listId,
      });
      if (created) createdClients.push(client.display_name);
      else linkedClients.push(client.display_name);
    } else {
      const supabase = await createClient();
      const userId = await requireUserId();
      const { data: clients } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", userId);
      const norm = name.trim().toLowerCase();
      const match = (clients ?? []).find(
        (c) => c.display_name.toLowerCase() === norm || c.first_name.toLowerCase() === norm,
      );

      await addListItem({ listId, label: match?.display_name ?? name.trim(), clientId: match?.id ?? null });

      if (match) {
        linkedClients.push(match.display_name);
        await logActivity({
          type: "added_to_list",
          description: `Added to ${list?.name ?? "list"}`,
          clientId: match.id,
          listId,
        });
      }
    }
  }

  revalidatePath(`/lists/${listId}`);
  revalidatePath("/clients");
  return { createdClients, linkedClients };
}

export async function toggleListItem(id: string, checked: boolean): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data } = await supabase
    .from("list_items")
    .update({ checked })
    .eq("user_id", userId)
    .eq("id", id)
    .select("list_id")
    .single();

  if (data) revalidatePath(`/lists/${data.list_id}`);
}

export async function removeListItem(id: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data } = await supabase
    .from("list_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("list_id")
    .single();

  if (data) revalidatePath(`/lists/${data.list_id}`);
}

export async function reorderListItems(listId: string, orderedIds: string[]): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("list_items")
        .update({ position: index })
        .eq("user_id", userId)
        .eq("id", id),
    ),
  );

  revalidatePath(`/lists/${listId}`);
}

export async function getListItemCounts(): Promise<Record<string, number>> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase.from("list_items").select("list_id").eq("user_id", userId);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.list_id] = (counts[row.list_id] ?? 0) + 1;
  }
  return counts;
}

export async function listListsForClient(clientId: string): Promise<List[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: items, error: itemsError } = await supabase
    .from("list_items")
    .select("list_id")
    .eq("user_id", userId)
    .eq("client_id", clientId);

  if (itemsError) throw itemsError;
  const listIds = Array.from(new Set((items ?? []).map((i) => i.list_id)));
  if (listIds.length === 0) return [];

  const { data: lists, error } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", userId)
    .in("id", listIds);

  if (error) throw error;
  return lists ?? [];
}

export async function searchLists(query: string): Promise<List[]> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", userId)
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
