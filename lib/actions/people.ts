"use server";

import { assertCanWrite } from "@/lib/billing";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { actorQuery, actorQueryOne, mineOrOrg } from "@/lib/db/scope";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { asUser } from "@/lib/db/as-user";
import { getMembership } from "@/lib/org";
import { logActivity } from "./activity";
import { createPersonSchema, updatePersonSchema, validate, toActionResult, type ActionResult } from "@/lib/validation";
import type { Person } from "@/lib/types";
import { fuzzyFilter } from "@/lib/fuzzy";

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName };
}

// The layout and most pages both need everyone; cache() makes that one query per request.
// Explicit columns skip search_vector, which can be large and is never read here.
const listPeopleCached = cache(async (): Promise<Person[]> => {
  const userId = await requireUserId();
  return query<Person>(
    `select id, user_id, first_name, last_name, display_name, phone, email, birthday, status,
            current_status, next_action, summary, needs_followup, ethnicity, income_level, gender, created_at, updated_at,
            last_activity_at, deleted_at
       from people where ${mineOrOrg("$1")} and deleted_at is null order by last_activity_at desc`,
    [userId],
  );
});

export async function listPeople(): Promise<Person[]> {
  return listPeopleCached();
}

export async function getPerson(id: string): Promise<Person | null> {
  const userId = await requireUserId();
  return queryOne<Person>(
    `select * from people where ${mineOrOrg("$1")} and id = $2 and deleted_at is null`,
    [userId, id],
  );
}

export async function createPersonRecord(params: {
  fullName: string;
  currentStatus?: string | null;
  nextAction?: string | null;
  /** Keep private: never shared with the user's organization. */
  personal?: boolean;
}): Promise<Person> {
  const userId = await requireUserId();
  await assertCanWrite();
  params = validate(createPersonSchema, params);
  const { firstName, lastName } = splitName(params.fullName);

  const person = await queryOne<Person>(
    `insert into people (user_id, first_name, last_name, display_name, current_status, next_action, personal)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      userId,
      firstName,
      lastName,
      params.fullName.trim(),
      params.currentStatus ?? null,
      params.nextAction ?? null,
      params.personal ?? false,
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
  const userId = await requireUserId();
  const norm = fullName.trim().toLowerCase();
  if (!norm) return null;

  return queryOne<Person>(
    `select * from people
     where ${mineOrOrg("$1")}
       and deleted_at is null
       and (lower(display_name) = $2 or lower(first_name) = $2 or lower(display_name) like $2 || '%')
     order by (lower(display_name) = $2) desc
     limit 1`,
    [userId, norm],
  );
}

export async function updatePerson(
  id: string,
  patch: Partial<
    Pick<
      Person,
      "current_status" | "next_action" | "status" | "phone" | "email" | "birthday" | "display_name" | "ethnicity" | "income_level" | "gender"
    >
  >,
): Promise<Person> {
  const userId = await requireUserId();
  await assertCanWrite();
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

  const person = await actorQueryOne<Person>(userId, 
    `update people set ${[...setClauses, "last_activity_at = now()"].join(", ")}
     where ${mineOrOrg("$1")} and id = $2 and deleted_at is null
     returning *`,
    [userId, id, ...values],
  );

  if (!person) throw new Error("Person not found");

  if (before && patch.display_name && before.display_name !== patch.display_name) {
    // List items keep a copy of the name as their label — keep linked ones in sync.
    await actorQuery(userId, `update list_items set label = $1 where ${mineOrOrg("$2")} and person_id = $3`, [
      person.display_name,
      userId,
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
/**
 * Who may delete a person: anyone for their own personal/solo records, but only
 * an organization's admins for its clients, so the agency's history and reports
 * can't be changed by any one staff member. ($1 = the signed-in user.)
 */
const MAY_DELETE = `(org_id is null or exists (select 1 from memberships m
  where m.user_id = $1 and m.org_id = people.org_id and m.active and m.role = 'admin'))`;

export async function deletePersonRecord(id: string): Promise<void> {
  const userId = await requireUserId();
  await assertCanWrite();
  const person = await actorQueryOne<Person>(userId, 
    `update people set deleted_at = now() where ${mineOrOrg("$1")} and ${MAY_DELETE} and id = $2 and deleted_at is null returning *`,
    [userId, id],
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
  revalidatePath("/lists", "layout");
}

/** Undoes deletePersonRecord(). */
export async function restorePersonRecord(id: string): Promise<void> {
  await restorePeople([id]);
}

/** Soft-deletes several people at once (People tab → Select → Delete). */
export async function deletePeople(ids: string[]): Promise<number> {
  const userId = await requireUserId();
  await assertCanWrite();
  if (ids.length === 0) return 0;
  const deleted = await actorQuery<{ id: string }>(userId, 
    `update people set deleted_at = now()
     where ${mineOrOrg("$1")} and ${MAY_DELETE} and id = any($2::uuid[]) and deleted_at is null
     returning id`,
    [userId, ids],
  );
  if (deleted.length) {
    await logActivity({
      type: "status_changed",
      description: `${deleted.length} ${deleted.length === 1 ? "person" : "people"} deleted`,
      personId: null,
    });
  }
  revalidatePath("/people");
  revalidatePath("/");
  revalidatePath("/lists", "layout");
  return deleted.length;
}

/** Undoes deletePeople(). */
export async function restorePeople(ids: string[]): Promise<void> {
  const userId = await requireUserId();
  await assertCanWrite();
  if (ids.length === 0) return;
  await actorQuery(userId, 
    `update people set deleted_at = null where ${mineOrOrg("$1")} and id = any($2::uuid[]) and deleted_at is not null`,
    [userId, ids],
  );
  revalidatePath("/people");
  revalidatePath("/");
  revalidatePath("/lists", "layout");
}

export async function touchPersonActivity(id: string): Promise<void> {
  const userId = await requireUserId();
  await query(
    `update people set last_activity_at = now() where ${mineOrOrg("$1")} and id = $2 and deleted_at is null`,
    [userId, id],
  );
}

export async function searchPeople(searchQuery: string): Promise<Person[]> {
  // Typo-tolerant: rank everyone in JS (a person list is small) instead of exact full-text matching.
  const people = await listPeople();
  return fuzzyFilter(
    people,
    searchQuery,
    (p) => [{ text: p.display_name, weight: 1 }, { text: p.current_status, weight: 0.8 }, { text: p.next_action, weight: 0.8 }, { text: p.summary, weight: 0.7 }],
    20,
  );
}

/** People needing attention: overdue tasks, no recent activity, or flagged for follow-up. */
export async function getPeopleNeedingAttention(): Promise<Person[]> {
  const userId = await requireUserId();
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
     where ${mineOrOrg("$1", "c.")}
       and c.deleted_at is null
       and (c.needs_followup = true or c.last_activity_at < $2 or t.id is not null)
     order by c.last_activity_at asc
     limit 10`,
    [userId, quietSince.toISOString()],
  );
}

/**
 * Org members: share a person with the organization, or keep them private.
 * Runs as the user, so the database checks they own the person and belong to
 * the organization. Making a client private is recorded in the
 * organization's activity log, so it's never silent.
 */
export async function setPersonShared(personId: string, shared: boolean): Promise<ActionResult<true>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
  await assertCanWrite();
    const m = await getMembership();
    if (!m?.active) throw new Error("You're not in an organization.");
    await asUser(userId, (q) =>
      q(
        `update people set org_id = $1, personal = $2, updated_at = now() where id = $3 and user_id = $4`,
        [shared ? m.orgId : null, !shared, personId, userId],
      ),
    );
    revalidatePath(`/people/${personId}`);
    return true as const;
  });
}
