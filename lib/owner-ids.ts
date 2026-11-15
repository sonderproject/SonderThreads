/**
 * Who the owner is (no imports, so sign-in itself can use it without an import cycle).
 * Two checks must BOTH pass:
 *   - the account's email is in OWNER_EMAILS (Vercel), and
 *   - the account's permanent id is in OWNER_USER_IDS (Vercel), so an email
 *     change or mix-up can never hand owner access to another account.
 */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "sonderproject.co@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** The master account's permanent Supabase user id (sonderproject.co@gmail.com). Not secret. */
const DEFAULT_OWNER_ID = "01f639c4-fcd1-4c7e-aeb5-07f257576438";
export function ownerUserIds(): string[] {
  return (process.env.OWNER_USER_IDS || DEFAULT_OWNER_ID)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Is this account the owner? (Both the id and the email must match.) */
export function isOwnerAccount(id: string, email: string): boolean {
  return ownerUserIds().includes(id.toLowerCase()) && ownerEmails().includes(email.toLowerCase());
}
