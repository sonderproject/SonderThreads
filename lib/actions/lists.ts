"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { logActivity } from "./activity";
import { findClientByName, findOrCreateClientByName, touchClientActivity } from "./clients";
import {
  addListItemSchema,
  createListSchema,
  updateListItemSchema,
  validate,
  toActionResult,
  type ActionResult,
} from "@/lib/validation";
import type { List, ListItem } from "@/lib/types";

export async function listLists(): Promise<List[]> {
  return query<List>(
    `select * from lists where user_id = $1 and deleted_at is null order by updated_at desc`,
    [OWNER_ID],
  );
}

export async function getListByName(name: string): Promise<List | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return queryOne<List>(
    `select * from lists where user_id = $1 and deleted_at is null and lower(name) = lower($2)`,
    [OWNER_ID, trimmed],
  );
}

export async function getListWithItems(id: string): Promise<{ list: List; items: ListItem[] } | null> {
  const list = await queryOne<List>(
    `select * from lists where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, id],
  );
  if (!list) return null;

  const items = await query<ListItem>(
    `select * from list_items where user_id = $1 and list_id = $2 order by position asc`,
    [OWNER_ID, id],
  );

  return { list, items };
}

export async function createList(params: {
  name: string;
  description?: string | null;
  isCohort?: boolean;
}): Promise<List> {
  params = validate(createListSchema, params);
  const list = await queryOne<List>(
    `insert into lists (user_id, name, description, is_cohort) values ($1, $2, $3, $4) returning *`,
    [OWNER_ID, params.name.trim(), params.description ?? null, params.isCohort ?? false],
  );

  if (!list) throw new Error("Failed to create list");

  await logActivity({
    type: "list_created",
    description: `List "${list.name}" created`,
    listId: list.id,
  });

  revalidatePath("/lists");
  revalidatePath("/");
  return list;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function createListSafe(params: Parameters<typeof createList>[0]): Promise<ActionResult<List>> {
  return toActionResult(() => createList(params));
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
  await query(`update lists set name = $1 where user_id = $2 and id = $3 and deleted_at is null`, [
    name.trim(),
    OWNER_ID,
    id,
  ]);
  revalidatePath(`/lists/${id}`);
  revalidatePath("/lists");
}

export async function updateListDescription(id: string, description: string): Promise<void> {
  await query(
    `update lists set description = $1 where user_id = $2 and id = $3 and deleted_at is null`,
    [description, OWNER_ID, id],
  );
  revalidatePath(`/lists/${id}`);
}

/** Soft-deletes a list — the row (and its items) stay in the database (recoverable) but disappear from every view. */
export async function deleteList(id: string): Promise<void> {
  await query(
    `update lists set deleted_at = now() where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, id],
  );
  revalidatePath("/lists");
  revalidatePath("/");
}

export async function duplicateList(id: string): Promise<List> {
  const existing = await getListWithItems(id);
  if (!existing) throw new Error("List not found");

  const copy = await createList({
    name: `${existing.list.name} (copy)`,
    description: existing.list.description,
    isCohort: existing.list.is_cohort,
  });

  for (const [index, item] of existing.items.entries()) {
    await query(
      `insert into list_items (user_id, list_id, client_id, label, checked, position)
       values ($1, $2, $3, $4, false, $5)`,
      [OWNER_ID, copy.id, item.client_id, item.label, index],
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
  params = validate(addListItemSchema, params);
  const last = await queryOne<{ position: number }>(
    `select position from list_items where user_id = $1 and list_id = $2 order by position desc limit 1`,
    [OWNER_ID, params.listId],
  );
  const nextPosition = (last?.position ?? -1) + 1;

  const item = await queryOne<ListItem>(
    `insert into list_items (user_id, list_id, client_id, label, position)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [OWNER_ID, params.listId, params.clientId ?? null, params.label.trim(), nextPosition],
  );

  if (!item) throw new Error("Failed to add list item");

  revalidatePath(`/lists/${params.listId}`);
  return item;
}

/** Adds a single free-text item, auto-linking it if the label matches an existing client. */
export async function addListItemSmart(listId: string, label: string): Promise<ListItem> {
  const match = await findClientByName(label);
  return addListItem({ listId, label: match?.display_name ?? label, clientId: match?.id ?? null });
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function addListItemSmartSafe(listId: string, label: string): Promise<ActionResult<ListItem>> {
  return toActionResult(() => addListItemSmart(listId, label));
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
  const list = await queryOne<List>(
    `select * from lists where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, listId],
  );

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
      const match = await findClientByName(name);
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

export async function updateListItem(id: string, label: string): Promise<ListItem> {
  const params = validate(updateListItemSchema, { label });
  const item = await queryOne<ListItem>(
    `update list_items set label = $1 where user_id = $2 and id = $3 returning *`,
    [params.label, OWNER_ID, id],
  );

  if (!item) throw new Error("Item not found");

  revalidatePath(`/lists/${item.list_id}`);
  return item;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function updateListItemSafe(id: string, label: string): Promise<ActionResult<ListItem>> {
  return toActionResult(() => updateListItem(id, label));
}

export async function toggleListItem(id: string, checked: boolean): Promise<void> {
  const item = await queryOne<{ list_id: string }>(
    `update list_items set checked = $1 where user_id = $2 and id = $3 returning list_id`,
    [checked, OWNER_ID, id],
  );
  if (item) revalidatePath(`/lists/${item.list_id}`);
}

export async function removeListItem(id: string): Promise<void> {
  const item = await queryOne<{ list_id: string }>(
    `delete from list_items where user_id = $1 and id = $2 returning list_id`,
    [OWNER_ID, id],
  );
  if (item) revalidatePath(`/lists/${item.list_id}`);
}

export async function reorderListItems(listId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      query(`update list_items set position = $1 where user_id = $2 and id = $3`, [
        index,
        OWNER_ID,
        id,
      ]),
    ),
  );
  revalidatePath(`/lists/${listId}`);
}

export async function getListItemCounts(): Promise<Record<string, number>> {
  const rows = await query<{ list_id: string; count: string }>(
    `select li.list_id, count(*)::text as count
     from list_items li
     join lists l on l.id = li.list_id
     where li.user_id = $1 and l.deleted_at is null
     group by li.list_id`,
    [OWNER_ID],
  );

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.list_id] = parseInt(row.count, 10);
  return counts;
}

export async function listListsForClient(clientId: string): Promise<List[]> {
  return query<List>(
    `select distinct l.* from lists l
     join list_items li on li.list_id = l.id
     where l.user_id = $1 and l.deleted_at is null and li.client_id = $2`,
    [OWNER_ID, clientId],
  );
}

export async function searchLists(searchQuery: string): Promise<List[]> {
  return query<List>(
    `select * from lists
     where user_id = $1
       and deleted_at is null
       and search_vector @@ plainto_tsquery('english', $2)
     order by ts_rank(search_vector, plainto_tsquery('english', $2)) desc
     limit 20`,
    [OWNER_ID, searchQuery],
  );
}
