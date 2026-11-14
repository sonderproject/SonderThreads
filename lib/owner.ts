import { notFound, redirect } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { logEvent } from "@/lib/events";

/**
 * The owner of Surfdesk (Sonder Project): the one master account that can open
 * the command center (/owner) and use its controls. Two checks must BOTH pass:
 *   - the account's email is in OWNER_EMAILS (Vercel), and
 *   - the account's permanent id is in OWNER_USER_IDS (Vercel), so an email
 *     change or mix-up can never hand owner access to another account.
 * The command center also requires two-step sign-in (2FA) on that account.
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

export async function isOwner(): Promise<boolean> {
  const userId = await requireUserId();
  const me = await queryOne<{ email: string }>(`select email from users where id = $1`, [userId]);
  return Boolean(me && isOwnerAccount(userId, me.email));
}

/**
 * Gate for the command center and every owner action. Everyone else gets an
 * ordinary 404, so the page's existence isn't revealed. The owner must have
 * two-step sign-in on (and the session already passed it: the app requires
 * that for any account with 2FA on); otherwise they're sent to turn it on.
 */
export async function requireOwner(): Promise<{ userId: string; email: string }> {
  const userId = await requireUserId();
  const me = await queryOne<{ email: string; mfa_enabled: boolean }>(`select email, mfa_enabled from users where id = $1`, [userId]);
  if (!me || !isOwnerAccount(userId, me.email)) notFound();
  if (!me.mfa_enabled) redirect("/settings/security?owner=2fa");
  return { userId, email: me.email };
}

/** Records an owner action in the event log (shown in the command center's Recent activity). */
export async function logOwnerAction(action: string, detail: string, meta: Record<string, unknown> = {}): Promise<void> {
  await logEvent(`owner.${action}`, detail, { level: "warn", meta }).catch(() => undefined);
}
