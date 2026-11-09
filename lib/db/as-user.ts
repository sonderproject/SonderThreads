import { transaction } from "@/lib/db/client";

export type UserQuery = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs queries as a signed-in user, so the database's access rules (RLS
 * policies in lib/db/schema.ts) decide what they can see and change — not
 * just the app's own filters. Used for everything that crosses between
 * people: organization members, supervisors, admins, invites, reassigning.
 *
 * Pass the id from requireUserId(). Inside, the connection acts as Supabase's
 * "authenticated" role with auth.uid() = userId, for this transaction only.
 */
export async function asUser<T>(userId: string, fn: (q: UserQuery) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(userId)) throw new Error("asUser needs a user id.");
  return transaction(async (raw) => {
    await raw(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: "authenticated" })]);
    await raw(`set local role authenticated`);
    const q: UserQuery = async (text, params = []) => ((await raw(text, params)) as { rows: never[] }).rows;
    return fn(q);
  });
}
