"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { logActivity } from "./activity";
import { createClientSchema, updateClientSchema, validate, toActionResult, type ActionResult } from "@/lib/validation";
import type { Client } from "@/lib/types";

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName };
}

export async function listClients(): Promise<Client[]> {
  return query<Client>(
    `select * from clients where user_id = $1 and deleted_at is null order by last_activity_at desc`,
    [OWNER_ID],
  );
}

export async function getClient(id: string): Promise<Client | null> {
  return queryOne<Client>(
    `select * from clients where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, id],
  );
}

export async function createClientRecord(params: {
  fullName: string;
  currentStatus?: string | null;
  nextAction?: string | null;
}): Promise<Client> {
  params = validate(createClientSchema, params);
  const { firstName, lastName } = splitName(params.fullName);

  const client = await queryOne<Client>(
    `insert into clients (user_id, first_name, last_name, display_name, current_status, next_action)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      OWNER_ID,
      firstName,
      lastName,
      params.fullName.trim(),
      params.currentStatus ?? null,
      params.nextAction ?? null,
    ],
  );

  if (!client) throw new Error("Failed to create client");

  await logActivity({
    type: "client_created",
    description: `${client.display_name} added`,
    clientId: client.id,
  });

  revalidatePath("/clients");
  revalidatePath("/");
  return client;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function createClientRecordSafe(
  params: Parameters<typeof createClientRecord>[0],
): Promise<ActionResult<Client>> {
  return toActionResult(() => createClientRecord(params));
}

/** Finds a client by loose name match, or creates one if none exists. */
export async function findOrCreateClientByName(
  fullName: string,
): Promise<{ client: Client; created: boolean }> {
  const match = await findClientByName(fullName);
  if (match) return { client: match, created: false };

  const created = await createClientRecord({ fullName });
  return { client: created, created: true };
}

/** Finds a client by loose name match without creating one. */
export async function findClientByName(fullName: string): Promise<Client | null> {
  const norm = fullName.trim().toLowerCase();
  if (!norm) return null;

  return queryOne<Client>(
    `select * from clients
     where user_id = $1
       and deleted_at is null
       and (lower(display_name) = $2 or lower(first_name) = $2 or lower(display_name) like $2 || '%')
     order by (lower(display_name) = $2) desc
     limit 1`,
    [OWNER_ID, norm],
  );
}

export async function updateClient(
  id: string,
  patch: Partial<
    Pick<Client, "current_status" | "next_action" | "status" | "phone" | "email" | "birthday" | "display_name">
  >,
): Promise<Client> {
  patch = validate(updateClientSchema, patch);
  const before = await getClient(id);

  const fields = Object.keys(patch) as (keyof typeof patch)[];
  const setClauses = fields.map((field, i) => `${field} = $${i + 3}`);
  const values = fields.map((field) => patch[field]);

  const client = await queryOne<Client>(
    `update clients set ${[...setClauses, "last_activity_at = now()"].join(", ")}
     where user_id = $1 and id = $2 and deleted_at is null
     returning *`,
    [OWNER_ID, id, ...values],
  );

  if (!client) throw new Error("Client not found");

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
  revalidatePath("/calendar");
  return client;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function updateClientSafe(
  id: string,
  patch: Parameters<typeof updateClient>[1],
): Promise<ActionResult<Client>> {
  return toActionResult(() => updateClient(id, patch));
}

/** Soft-deletes a client — the row stays in the database (recoverable) but disappears from every view. */
export async function deleteClientRecord(id: string): Promise<void> {
  const client = await queryOne<Client>(
    `update clients set deleted_at = now() where user_id = $1 and id = $2 and deleted_at is null returning *`,
    [OWNER_ID, id],
  );

  if (client) {
    await logActivity({
      type: "status_changed",
      description: `${client.display_name} deleted`,
      clientId: null,
    });
  }

  revalidatePath("/clients");
  revalidatePath("/");
}

export async function touchClientActivity(id: string): Promise<void> {
  await query(
    `update clients set last_activity_at = now() where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, id],
  );
}

export async function searchClients(searchQuery: string): Promise<Client[]> {
  return query<Client>(
    `select * from clients
     where user_id = $1
       and deleted_at is null
       and search_vector @@ plainto_tsquery('english', $2)
     order by ts_rank(search_vector, plainto_tsquery('english', $2)) desc
     limit 20`,
    [OWNER_ID, searchQuery],
  );
}

/** Clients needing attention: overdue tasks, no recent activity, or flagged for follow-up. */
export async function getClientsNeedingAttention(): Promise<Client[]> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 7);

  return query<Client>(
    `select distinct c.* from clients c
     left join tasks t on t.client_id = c.id
       and t.user_id = $1
       and t.completed = false
       and t.due_at is not null
       and t.due_at < now()
       and t.deleted_at is null
     where c.user_id = $1
       and c.deleted_at is null
       and (c.needs_followup = true or c.last_activity_at < $2 or t.id is not null)
     order by c.last_activity_at asc
     limit 10`,
    [OWNER_ID, staleThreshold.toISOString()],
  );
}
