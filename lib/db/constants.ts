/**
 * Before accounts existed every row belonged to this fixed id. The first
 * person to sign up with the old shared APP_PASSWORD gets an account with
 * this id, so they keep all of that data. Nothing else should use it —
 * every query is scoped to the signed-in user via requireUserId().
 */
export const LEGACY_OWNER_ID = "00000000-0000-0000-0000-000000000001";
