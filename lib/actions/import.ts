"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { logActivity } from "./activity";
import { createPersonRecord, touchPersonActivity } from "./people";
import { findOrCreateListByName } from "./lists";
import { importPeopleSchema, validate, toActionResult, type ActionResult } from "@/lib/validation";
import type { Person } from "@/lib/types";
import type { ImportRow } from "@/lib/csv";
import { parsePersonLine } from "@/lib/parse-person-line";

export type ImportResult = { listId: string; created: number; linked: number; alreadyOnList: number };

/**
 * Creates (or reuses) a list and adds every imported row to it as a person.
 * Existing people are matched by exact name so an import never quietly
 * merges "Marcus Smith" into "Marcus Johnson"; blank contact fields on a
 * matched person are filled in, but existing values are never overwritten.
 */
export async function importPeopleToList(params: {
  listName: string;
  isGroup: boolean;
  rows: ImportRow[];
}): Promise<ImportResult> {
  const userId = await requireUserId();
  params = validate(importPeopleSchema, params);
  const { list } = await findOrCreateListByName(params.listName, params.isGroup);

  const onList = await query<{ person_id: string }>(
    `select person_id from list_items where user_id = $1 and list_id = $2 and person_id is not null`,
    [userId, list.id],
  );
  const onListIds = new Set(onList.map((r) => r.person_id));
  const last = await queryOne<{ position: number }>(
    `select position from list_items where user_id = $1 and list_id = $2 order by position desc limit 1`,
    [userId, list.id],
  );
  let position = (last?.position ?? -1) + 1;

  let created = 0;
  let linked = 0;
  let alreadyOnList = 0;

  for (const row of params.rows) {
    let person = await queryOne<Person>(
      `select * from people where user_id = $1 and deleted_at is null and lower(display_name) = lower($2) limit 1`,
      [userId, row.name],
    );
    if (person) linked++;
    else {
      person = await createPersonRecord({ fullName: row.name });
      created++;
    }

    await query(
      `update people set
         email = coalesce(email, $3),
         phone = coalesce(phone, $4),
         birthday = coalesce(birthday, $5::date)
       where user_id = $1 and id = $2`,
      [userId, person.id, row.email, row.phone, row.birthday],
    );

    if (onListIds.has(person.id)) {
      alreadyOnList++;
      continue;
    }
    onListIds.add(person.id);

    await query(
      `insert into list_items (user_id, list_id, person_id, label, position) values ($1, $2, $3, $4, $5)`,
      [userId, list.id, person.id, person.display_name, position++],
    );
    await touchPersonActivity(person.id);
    await logActivity({
      type: "added_to_list",
      description: `Added to ${list.name} (import)`,
      personId: person.id,
      listId: list.id,
    });
  }

  revalidatePath("/lists");
  revalidatePath(`/lists/${list.id}`);
  revalidatePath("/people");
  revalidatePath("/");
  revalidatePath("/calendar");
  return { listId: list.id, created, linked, alreadyOnList };
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function importPeopleToListSafe(
  params: Parameters<typeof importPeopleToList>[0],
): Promise<ActionResult<ImportResult>> {
  return toActionResult(() => importPeopleToList(params));
}

export type ListToPeopleResult = {
  created: number;
  linked: number;
  skipped: number;
  /** item id → the person it now links to */
  links: Record<string, string>;
};

/**
 * "Add to People" on a list: every item becomes (or links to) a person.
 * Each label is split into name / birthday / phone ("Marcus Johnson 05/12
 * 5551234567"); the person is named with the letters only, and their phone
 * and birthday are filled in where blank. People are matched by exact name,
 * like CSV import. Item labels are left as they are.
 */
export async function addListItemsToPeople(listId: string): Promise<ListToPeopleResult> {
  const userId = await requireUserId();
  const list = await queryOne<{ id: string; name: string }>(
    `select id, name from lists where user_id = $1 and id = $2 and deleted_at is null`,
    [userId, listId],
  );
  if (!list) throw new Error("List not found");

  const items = await query<{ id: string; label: string; person_id: string | null }>(
    `select li.id, li.label, case when p.deleted_at is null then li.person_id end as person_id
       from list_items li left join people p on p.id = li.person_id
      where li.user_id = $1 and li.list_id = $2
      order by li.position`,
    [userId, listId],
  );

  let created = 0;
  let linked = 0;
  let skipped = 0;
  const links: Record<string, string> = {};

  for (const item of items) {
    const { name, phone, birthday } = parsePersonLine(item.label);
    let personId = item.person_id;

    if (!personId) {
      if (!name) {
        skipped++;
        continue;
      }
      let person = await queryOne<Person>(
        `select * from people where user_id = $1 and deleted_at is null and lower(display_name) = lower($2) limit 1`,
        [userId, name],
      );
      if (person) linked++;
      else {
        person = await createPersonRecord({ fullName: name });
        created++;
      }
      personId = person.id;
      await query(`update list_items set person_id = $3 where user_id = $1 and id = $2`, [userId, item.id, personId]);
      links[item.id] = personId;
      await logActivity({ type: "added_to_list", description: `Added to ${list.name}`, personId, listId });
      await touchPersonActivity(personId);
    }

    if (phone || birthday) {
      await query(
        `update people set phone = coalesce(phone, $3), birthday = coalesce(birthday, $4::date)
         where user_id = $1 and id = $2`,
        [userId, personId, phone, birthday],
      );
    }
  }

  revalidatePath(`/lists/${listId}`);
  revalidatePath("/people");
  revalidatePath("/");
  revalidatePath("/calendar");
  return { created, linked, skipped, links };
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function addListItemsToPeopleSafe(listId: string): Promise<ActionResult<ListToPeopleResult>> {
  return toActionResult(() => addListItemsToPeople(listId));
}
