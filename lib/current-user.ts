import { OWNER_ID } from "@/lib/db/constants";

/**
 * The id of the user whose data a request may read or write. Every query
 * gets its user_id from here — nothing else should use OWNER_ID directly.
 *
 * Today the app has a single owner, so this always returns OWNER_ID. When
 * accounts are added (see docs/accounts-plan.md), this becomes a session
 * lookup that redirects to sign-in when there's no valid session, and no
 * caller needs to change.
 */
export async function requireUserId(): Promise<string> {
  return OWNER_ID;
}
