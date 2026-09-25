"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { logActivity } from "./activity";
import { createPersonSchema, updatePersonSchema, validate, toActionResult, type ActionResult } from "@/lib/validation";
import type { Person } from "@/lib/types";

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName };
}

export async function listPeople(): Promise<Person[]> {
  return query<Person>(
    `select * from people where user_id = $1 and deleted_at is null order by last_activity_at desc`,
    [OWNER_ID],
  );
}

export async function getPerson(id: string): Promise<Person | null> {
  return queryOne<Person>(
    `select * from people where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, id],
  );
}

export async function createPersonRecord(params: {
  fullName: string;
  currentStatus?: string | null;
  nextAction?: string | null;
}): Promise<Person> {
  params = validate(createPersonSchema, params);
  const { firstName, lastName } = splitName(params.fullName);

  const person = await queryOne<Person>(
    `insert into people (user_id, first_name, last_name, display_name, current_status, next_action)
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

  if (!person) throw new Error("Failed to create person");

  await logActivity({
    type: "person_created",
    description: `${person.display_name} added`,
    personId: person.id,
  });

  revalidatePath("/people");
  revalidatePath("/");
  return person;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function createPersonRecordSafe(
  params: Parameters<typeof createPersonRecord>[0],
): Promise<ActionResult<Person>> {
  return toActionResult(() => createPersonRecord(params));
}

/** Finds a person by loose name match, or creates one if none exists. */
export async function findOrCreatePersonByName(
  fullName: string,
): Promise<{ person: Person; created: boolean }> {
  const match = await findPersonByName(fullName);
  if (match) return { person: match, created: false };

  const created = await createPersonRecord({ fullName });
  return { person: created, created: true };
}

/** Finds a person by loose name match without creating one. */
export async function findPersonByName(fullName: string): Promise<Person | null> {
  const norm = fullName.trim().toLowerCase();
  if (!norm) return null;

  return queryOne<Person>(
    `select * from people
     where user_id = $1
       and deleted_at is null
       and (lower(display_name) = $2 or lower(first_name) = $2 or lower(display_name) like $2 || '%')
     order by (lower(display_name) = $2) desc
     limit 1`,
    [OWNER_ID, norm],
  );
}

export async function updatePerson(
  id: string,
  patch: Partial<
    Pick<Person, "current_status" | "next_action" | "status" | "phone" | "email" | "birthday" | "display_name">
  >,
): Promise<Person> {
  patch = validate(updatePersonSchema, patch);
  const before = await getPerson(id);

  // A cleared contact field is stored as null, not "".
  for (const key of ["phone", "email", "birthday"] as const) {
    if (patch[key] === "") patch[key] = null;
  }

  const columns: Record<string, unknown> = { ...patch };
  if (patch.display_name) {
    const { firstName, lastName } = splitName(patch.display_name);
    columns.first_name = firstName;
    columns.last_name = lastName;
  }

  const fields = Object.keys(columns);
  const setClauses = fields.map((field, i) => `${field} = $${i + 3}`);
  const values = fields.map((field) => columns[field]);

  const person = await queryOne<Person>(
    `update people set ${[...setClauses, "last_activity_at = now()"].join(", ")}
     where user_id = $1 and id = $2 and deleted_at is null
     returning *`,
    [OWNER_ID, id, ...values],
  );

  if (!person) throw new Error("Person not found");

  if (before && patch.display_name && before.display_name !== patch.display_name) {
    // List items keep a copy of the name as their label — keep linked ones in sync.
    await query(`update list_items set label = $1 where user_id = $2 and person_id = $3`, [
      person.display_name,
      OWNER_ID,
      id,
    ]);
    await logActivity({
      type: "status_changed",
      description: `Renamed from ${before.display_name} to ${person.display_name}`,
      personId: id,
    });
    revalidatePath("/lists");
  }

  if (before && patch.current_status !== undefined && before.current_status !== patch.current_status) {
    await logActivity({
      type: "status_changed",
      description: `Current status updated: ${patch.current_status}`,
      personId: id,
    });
  }

  if (before && patch.next_action !== undefined && before.next_action !== patch.next_action) {
    await logActivity({
      type: "status_changed",
      description: `Next action updated: ${patch.next_action}`,
      personId: id,
    });
  }

  revalidatePath(`/people/${id}`);
  revalidatePath("/people");
  revalidatePath("/");
  revalidatePath("/calendar");
  return person;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function updatePersonSafe(
  id: string,
  patch: Parameters<typeof updatePerson>[1],
): Promise<ActionResult<Person>> {
  return toActionResult(() => updatePerson(id, patch));
}

/** Soft-deletes a person — the row stays in the database (recoverable) but disappears from every view. */
export async function deletePersonRecord(id: string): Promise<void> {
  const person = await queryOne<Person>(
    `update people set deleted_at = now() where user_id = $1 and id = $2 and deleted_at is null returning *`,
    [OWNER_ID, id],
  );

  if (person) {
    await logActivity({
      type: "status_changed",
      description: `${person.display_name} deleted`,
      personId: null,
    });
  }

  revalidatePath("/people");
  revalidatePath("/");
}

export async function touchPersonActivity(id: string): Promise<void> {
  await query(
    `update people set last_activity_at = now() where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, id],
  );
}

export async function searchPeople(searchQuery: string): Promise<Person[]> {
  return query<Person>(
    `select * from people
     where user_id = $1
       and deleted_at is null
       and search_vector @@ plainto_tsquery('english', $2)
     order by ts_rank(search_vector, plainto_tsquery('english', $2)) desc
     limit 20`,
    [OWNER_ID, searchQuery],
  );
}

/** People needing attention: overdue tasks, no recent activity, or flagged for follow-up. */
export async function getPeopleNeedingAttention(): Promise<Person[]> {
  const quietSince = new Date();
  quietSince.setDate(quietSince.getDate() - 7);

  return query<Person>(
    `select distinct c.* from people c
     left join tasks t on t.person_id = c.id
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
    [OWNER_ID, quietSince.toISOString()],
  );
}
