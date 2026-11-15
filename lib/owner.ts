import { notFound, redirect } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { logEvent } from "@/lib/events";

import { isOwnerAccount, ownerEmails } from "@/lib/owner-ids";
import { sendEmail, escapeHtml, appUrl } from "@/lib/email";

export { isOwnerAccount, ownerEmails, ownerUserIds } from "@/lib/owner-ids";

/**
 * The owner of Surfdesk (Sonder Project): the one master account that can open
 * the command center (/owner) and use its controls. Identity is checked in
 * lib/owner-ids.ts (pinned id AND email); the command center also requires
 * two-step sign-in (2FA) on that account.
 */

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

/**
 * Records an owner action in the event log (shown in the command center's Recent activity)
 * and emails the owner a copy, so any change made from the command center is noticed.
 */
export async function logOwnerAction(action: string, detail: string, meta: Record<string, unknown> = {}): Promise<void> {
  await logEvent(`owner.${action}`, detail, { level: "warn", meta }).catch(() => undefined);
  const lines = [detail, ...Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)];
  const text = `${lines.join("\n")}\n\nIf this wasn't you, change your password and turn two-step sign-in off and on again.\n${appUrl()}/owner`;
  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6">${lines
    .map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`)
    .join("")}<p style="margin:16px 0 0;color:#6e5f4d;font-size:13px">If this wasn&#39;t you, change your password right away.</p></div>`;
  await Promise.all(
    ownerEmails().map((to) => sendEmail({ to, subject: `Surfdesk command center: ${detail}`.slice(0, 150), text, html }).catch(() => undefined)),
  );
}
