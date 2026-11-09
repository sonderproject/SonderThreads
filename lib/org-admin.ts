import { queryOne } from "@/lib/db/client";

type Q = (text: string, params?: unknown[]) => Promise<unknown>;

/**
 * Hands every organization client of `fromUser` (and everything attached:
 * notes, tasks, check-ins, activity, summaries) to `toUser`, inside the
 * caller's transaction. Their personal records stay with them. Entries on
 * their personal lists that point at those clients are removed, so someone
 * leaving keeps no client names. Not a server action: callers check that the
 * signed-in person is allowed (an org admin, or the person leaving).
 */
export async function transferOrgClients(
  q: Q,
  orgId: string,
  fromUser: string,
  toUser: string,
  /** Just this one client; omit for all of them. */
  personId: string | null = null,
): Promise<void> {
  const ids = `(select id from people where user_id = $1 and org_id = $2 and ($4::uuid is null or id = $4))`;
  const move = [fromUser, orgId, toUser, personId];
  await q(`update notes set user_id = $3 where user_id = $1 and person_id in ${ids}`, move);
  await q(`update tasks set user_id = $3, list_id = null where user_id = $1 and person_id in ${ids}`, move);
  await q(`update check_ins set user_id = $3 where user_id = $1 and person_id in ${ids}`, move);
  await q(`update activity set user_id = $3, list_id = null where user_id = $1 and person_id in ${ids}`, move);
  await q(`update person_summaries set user_id = $3 where user_id = $1 and person_id in ${ids}`, move);
  const idsForDelete = `(select id from people where user_id = $1 and org_id = $2 and ($3::uuid is null or id = $3))`;
  await q(`delete from list_items where user_id = $1 and person_id in ${idsForDelete}`, [fromUser, orgId, personId]);
  await q(`delete from notifications where user_id = $1 and person_id in ${idsForDelete}`, [fromUser, orgId, personId]);
  await q(`update people set user_id = $3, updated_at = now() where user_id = $1 and org_id = $2 and ($4::uuid is null or id = $4)`, move);
}

/** Another active admin of the organization, to receive clients when an admin or member leaves. */
export async function otherActiveAdmin(orgId: string, notUser: string): Promise<string | null> {
  const row = await queryOne<{ user_id: string }>(
    `select user_id from memberships where org_id = $1 and active and role = 'admin' and user_id <> $2
      order by created_at limit 1`,
    [orgId, notUser],
  );
  return row?.user_id ?? null;
}
