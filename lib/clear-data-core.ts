import { transaction } from "@/lib/db/client";

/**
 * Deletes a user's own (non-organization) records in one transaction. Not a
 * server action: the caller passes the id from requireUserId()
 * (lib/actions/clear-data.ts). Organization clients and their records stay.
 */
export async function clearUserData(userId: string): Promise<void> {
  await transaction(async (q) => {
    const personal = `(select id from people where user_id = $1 and org_id is null)`;
    await q(`delete from notifications where user_id = $1`, [userId]);
    await q(`delete from activity where user_id = $1 and org_id is null`, [userId]);
    await q(`delete from person_summaries where user_id = $1 and org_id is null`, [userId]);
    await q(`delete from check_ins where user_id = $1 and org_id is null`, [userId]);
    await q(`delete from list_items where user_id = $1 and org_id is null`, [userId]);
    await q(`delete from tasks where user_id = $1 and org_id is null`, [userId]);
    await q(`delete from notes where user_id = $1 and org_id is null`, [userId]);
    await q(`delete from lists where user_id = $1 and not exists (select 1 from list_items i where i.list_id = lists.id)`, [userId]);
    await q(`delete from people where id in ${personal}`, [userId]);
  });
}
