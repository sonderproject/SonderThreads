import { escapeHtml } from "@/lib/email";
import { ROLE_LABELS, type OrgRole } from "@/lib/org-roles";

/** The organization invite email (single invites and bulk invites). */
export function inviteEmail(p: { to: string; url: string; role: OrgRole; org: string; inviter: string; inviterEmail: string }) {
  const roleName = `${p.role === "admin" ? "an" : "a"} ${ROLE_LABELS[p.role].toLowerCase()}`;
  const subject = `${p.inviter} invited you to join ${p.org} on Surfdesk`;
  const text = [
    `${p.inviter} invited you to join ${p.org} on Surfdesk as ${roleName}.`,
    "",
    `Accept the invite: ${p.url}`,
    "",
    `Sign up or sign in with this email address (${p.to}). The link works once and expires in 14 days.`,
  ].join("\n");
  const html = `<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#141412;max-width:480px">
  <p>${escapeHtml(p.inviter)} invited you to join <strong>${escapeHtml(p.org)}</strong> on Surfdesk as ${escapeHtml(roleName)}.</p>
  <p><a href="${escapeHtml(p.url)}" style="display:inline-block;background:#1c77b5;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:600">Accept the invite</a></p>
  <p style="color:#6e5f4d;font-size:13px">Sign up or sign in with this email address (${escapeHtml(p.to)}). The link works once and expires in 14 days.</p>
</div>`;
  return { to: p.to, subject, text, html, replyTo: p.inviterEmail };
}
