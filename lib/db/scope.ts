/**
 * Shared caseload: a row is reachable by its owner, or by any active member of
 * the organization it belongs to. Personal rows (org_id null) stay owner-only.
 * `param` is the SQL placeholder holding requireUserId(); `alias` a table prefix like "c.".
 */
export function mineOrOrg(param: string, alias = ""): string {
  return `(${alias}user_id = ${param} or ${alias}org_id in (select org_id from memberships where user_id = ${param} and active))`;
}

import type { QueryResultRow } from "pg";
import { transaction } from "@/lib/db/client";

/**
 * Runs one write as `userId` for the activity log: the audit trigger reads the
 * actor from request.jwt.claims, so a colleague editing a shared client is
 * logged as themselves, not the client's owner. Access is still decided by the
 * query's own mineOrOrg() filter.
 */
export async function actorQuery<T extends QueryResultRow = QueryResultRow>(
  userId: string,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return transaction(async (raw) => {
    await raw(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId })]);
    const r = (await raw(text, params)) as unknown as { rows: T[] };
    return r.rows;
  });
}

export async function actorQueryOne<T extends QueryResultRow = QueryResultRow>(
  userId: string,
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  return (await actorQuery<T>(userId, text, params))[0] ?? null;
}
