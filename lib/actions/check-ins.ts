"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { logActivity } from "./activity";
import { getPerson, touchPersonActivity } from "./people";
import { truncate } from "./helpers";
import {
  createCheckInSchema,
  updateCheckInSchema,
  validate,
  toActionResult,
  type ActionResult,
} from "@/lib/validation";
import type { CheckIn, CheckInWithPerson } from "@/lib/types";

function revalidate(personId: string) {
  revalidatePath("/check-ins");
  revalidatePath("/");
  revalidatePath(`/people/${personId}`);
}

export async function createCheckIn(params: {
  personId: string;
  /** ISO timestamp; defaults to now. */
  checkedInAt?: string | null;
  reason?: string | null;
}): Promise<CheckIn> {
  const userId = await requireUserId();
  params = validate(createCheckInSchema, params);
  const person = await getPerson(params.personId);
  if (!person) throw new Error("Person not found");

  const reason = params.reason?.trim() || null;
  const checkIn = await queryOne<CheckIn>(
    `insert into check_ins (user_id, person_id, checked_in_at, reason)
     values ($1, $2, coalesce($3::timestamptz, now()), $4)
     returning *`,
    [userId, person.id, params.checkedInAt ?? null, reason],
  );
  if (!checkIn) throw new Error("Failed to save check-in");

  await Promise.all([
    logActivity({
      type: "check_in",
      description: reason ? `Checked in: ${truncate(reason)}` : "Checked in",
      personId: person.id,
    }),
    touchPersonActivity(person.id),
  ]);

  revalidate(person.id);
  return checkIn;
}

/** Client-form-safe wrapper: returns a result instead of throwing, since Next.js redacts thrown Server Action errors before they reach the client in production. */
export async function createCheckInSafe(
  params: Parameters<typeof createCheckIn>[0],
): Promise<ActionResult<CheckIn>> {
  return toActionResult(() => createCheckIn(params));
}

export async function updateCheckIn(
  id: string,
  patch: { checkedInAt?: string; reason?: string | null },
): Promise<CheckIn> {
  const userId = await requireUserId();
  const params = validate(updateCheckInSchema, patch);
  const checkIn = await queryOne<CheckIn>(
    `update check_ins
     set checked_in_at = coalesce($3::timestamptz, checked_in_at),
         reason = case when $4 then $5 else reason end,
         updated_at = now()
     where user_id = $1 and id = $2 and deleted_at is null
     returning *`,
    [
      userId,
      id,
      params.checkedInAt ?? null,
      params.reason !== undefined,
      params.reason?.trim() || null,
    ],
  );
  if (!checkIn) throw new Error("Check-in not found");
  revalidate(checkIn.person_id);
  return checkIn;
}

/** Client-form-safe wrapper for updateCheckIn(). */
export async function updateCheckInSafe(
  id: string,
  patch: Parameters<typeof updateCheckIn>[1],
): Promise<ActionResult<CheckIn>> {
  return toActionResult(() => updateCheckIn(id, patch));
}

/** Soft-deletes a check-in so it can be restored with Undo. */
export async function deleteCheckIn(id: string): Promise<void> {
  await setCheckInDeleted(id, true);
}

export async function restoreCheckIn(id: string): Promise<void> {
  await setCheckInDeleted(id, false);
}

async function setCheckInDeleted(id: string, deleted: boolean): Promise<void> {
  const userId = await requireUserId();
  const row = await queryOne<CheckIn>(
    `update check_ins set deleted_at = ${deleted ? "now()" : "null"}
     where user_id = $1 and id = $2 and deleted_at is ${deleted ? "null" : "not null"}
     returning *`,
    [userId, id],
  );
  if (row) revalidate(row.person_id);
}

/**
 * Check-ins between two instants (either side optional), newest first.
 * The page widens its local-day range by a day on each side and trims to
 * exact local days in the browser, so the server needn't know the time zone.
 */
export async function listCheckIns(range: { from?: string | null; to?: string | null } = {}): Promise<CheckInWithPerson[]> {
  const userId = await requireUserId();
  const valid = (v?: string | null) => (v && !Number.isNaN(Date.parse(v)) ? v : null);
  return query<CheckInWithPerson>(
    `select c.*, p.display_name
     from check_ins c
     join people p on p.id = c.person_id and p.deleted_at is null
     where c.user_id = $1 and c.deleted_at is null
       and ($2::timestamptz is null or c.checked_in_at >= $2::timestamptz)
       and ($3::timestamptz is null or c.checked_in_at < $3::timestamptz)
     order by c.checked_in_at desc
     limit 20000`,
    [userId, valid(range.from), valid(range.to)],
  );
}

export async function listCheckInsForPerson(personId: string): Promise<CheckInWithPerson[]> {
  const userId = await requireUserId();
  return query<CheckInWithPerson>(
    `select c.*, p.display_name
     from check_ins c
     join people p on p.id = c.person_id
     where c.user_id = $1 and c.person_id = $2 and c.deleted_at is null
     order by c.checked_in_at desc`,
    [userId, personId],
  );
}

/** Reasons used before, most frequent first — offered as quick-pick chips. */
export async function listCheckInReasons(limit = 8): Promise<string[]> {
  const userId = await requireUserId();
  const rows = await query<{ reason: string }>(
    `select min(reason) as reason
     from check_ins
     where user_id = $1 and deleted_at is null and reason is not null and reason <> ''
     group by lower(reason)
     order by count(*) desc, max(checked_in_at) desc
     limit $2`,
    [userId, limit],
  );
  return rows.map((r) => r.reason);
}
