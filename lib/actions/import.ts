"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { logActivity } from "./activity";
import { createPersonRecord, touchPersonActivity } from "./people";
import { findOrCreateListByName } from "./lists";
import { importPeopleSchema, validate, toActionResult, type ActionResult } from "@/lib/validation";
import type { Person } from "@/lib/types";
import type { ImportRow } from "@/lib/csv";

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
  params = validate(importPeopleSchema, params);
  const { list } = await findOrCreateListByName(params.listName, params.isGroup);

  const onList = await query<{ person_id: string }>(
    `select person_id from list_items where user_id = $1 and list_id = $2 and person_id is not null`,
    [OWNER_ID, list.id],
  );
  const onListIds = new Set(onList.map((r) => r.person_id));
  const last = await queryOne<{ position: number }>(
    `select position from list_items where user_id = $1 and list_id = $2 order by position desc limit 1`,
    [OWNER_ID, list.id],
  );
  let position = (last?.position ?? -1) + 1;

  let created = 0;
  let linked = 0;
  let alreadyOnList = 0;

  for (const row of params.rows) {
    let person = await queryOne<Person>(
      `select * from people where user_id = $1 and deleted_at is null and lower(display_name) = lower($2) limit 1`,
      [OWNER_ID, row.name],
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
      [OWNER_ID, person.id, row.email, row.phone, row.birthday],
    );

    if (onListIds.has(person.id)) {
      alreadyOnList++;
      continue;
    }
    onListIds.add(person.id);

    await query(
      `insert into list_items (user_id, list_id, person_id, label, position) values ($1, $2, $3, $4, $5)`,
      [OWNER_ID, list.id, person.id, person.display_name, position++],
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
