"use server";

import { randomBytes, randomUUID } from "crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne, transaction } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { isOrgRole, ROLE_LABELS, type OrgRole } from "@/lib/org-roles";
import { hashToken } from "@/lib/session";
import { appUrl, sendEmailBatch } from "@/lib/email";
import { inviteEmail } from "@/lib/invite-email";
import { logEvent } from "@/lib/events";
import { recordAcceptance } from "@/lib/legal-server";
import { SeatLimitError, assertCanWrite, assertSeatAvailable, seatUsage, syncOrgSeats } from "@/lib/billing";
import { emailDomain, parseBulkInvites, parseJoinDomains, PUBLIC_EMAIL_DOMAINS } from "@/lib/bulk-invite";
import { toActionResult, type ActionResult } from "@/lib/validation";

const INVITE_DAYS = 14;
/** Bulk sends per organization per hour (each can hold up to 1,000 invites, capped by seats). */
const BATCHES_PER_HOUR = 5;

async function requireAdmin(): Promise<{ userId: string; orgId: string; orgName: string }> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m || !m.active || m.role !== "admin") throw new Error("Only an organization admin can do that.");
  return { userId, orgId: m.orgId, orgName: m.orgName };
}

export type BulkPreview = {
  toInvite: number;
  resend: number;
  members: number;
  invalid: string[];
  duplicates: number;
  byRole: Record<OrgRole, number>;
  seatsLeft: number | null;
  seatsNeeded: number;
};

/** Sorts a pasted list or CSV into: new invites, invites to send again, already members, and problems. */
async function sortList(orgId: string, text: string, defaultRole: OrgRole) {
  const parsed = parseBulkInvites(text, defaultRole);
  const emails = parsed.rows.map((r) => r.email);
  const [members, pending, seats] = await Promise.all([
    query<{ email: string }>(
      `select lower(u.email) as email from memberships m join users u on u.id = m.user_id
        where m.org_id = $1 and m.active and lower(u.email) = any($2::text[])`,
      [orgId, emails],
    ),
    query<{ email: string }>(
      `select lower(email) as email from invitations
        where org_id = $1 and accepted_at is null and expires_at > now() and lower(email) = any($2::text[])`,
      [orgId, emails],
    ),
    seatUsage(orgId),
  ]);
  const memberSet = new Set(members.map((m) => m.email));
  const pendingSet = new Set(pending.map((p) => p.email));
  const rows = parsed.rows.filter((r) => !memberSet.has(r.email));
  const fresh = rows.filter((r) => !pendingSet.has(r.email)).length;
  const seatsLeft = seats.purchased === null ? null : Math.max(0, seats.purchased - seats.active - seats.pending);
  return { parsed, rows, members: memberSet.size, resend: rows.length - fresh, fresh, seatsLeft };
}

/** Step 1: what would happen (nothing is sent). */
export async function previewBulkInvites(text: string, defaultRole: string): Promise<ActionResult<BulkPreview>> {
  return toActionResult(async () => {
    const { orgId } = await requireAdmin();
    const role: OrgRole = isOrgRole(defaultRole) ? defaultRole : "case_manager";
    const s = await sortList(orgId, text, role);
    const byRole: Record<OrgRole, number> = { admin: 0, supervisor: 0, case_manager: 0 };
    for (const r of s.rows) byRole[r.role]++;
    return {
      toInvite: s.fresh,
      resend: s.resend,
      members: s.members,
      invalid: s.parsed.invalid,
      duplicates: s.parsed.duplicates,
      byRole,
      seatsLeft: s.seatsLeft,
      seatsNeeded: Math.max(0, s.fresh - (s.seatsLeft ?? Infinity)),
    };
  });
}

/** Step 2: creates the invites now and emails them in the background (progress via bulkInviteProgress). */
export async function sendBulkInvites(text: string, defaultRole: string): Promise<ActionResult<{ batchId: string; total: number }>> {
  return toActionResult(async () => {
    const { userId, orgId, orgName } = await requireAdmin();
    await assertCanWrite();
    const role: OrgRole = isOrgRole(defaultRole) ? defaultRole : "case_manager";
    const recent = await queryOne<{ n: number }>(
      `select count(distinct batch_id)::int as n from invitations where org_id = $1 and batch_id is not null and created_at > now() - interval '1 hour'`,
      [orgId],
    );
    if ((recent?.n ?? 0) >= BATCHES_PER_HOUR) throw new Error("That's several bulk sends in one hour. Please try again a little later.");
    const s = await sortList(orgId, text, role);
    if (s.rows.length === 0) throw new Error("No new people to invite in that list.");
    if (s.seatsLeft !== null && s.fresh > s.seatsLeft) {
      throw new Error(
        `That's ${s.fresh} new ${s.fresh === 1 ? "person" : "people"} but only ${s.seatsLeft} ${s.seatsLeft === 1 ? "seat is" : "seats are"} left. Add seats in Billing, or shorten the list.`,
      );
    }

    const batchId = randomUUID();
    const links = s.rows.map((r) => ({ ...r, token: randomBytes(32).toString("base64url") }));
    await transaction(async (q) => {
      // A new invite replaces any earlier unused one for the same address (like single invites).
      await q(`delete from invitations where org_id = $1 and accepted_at is null and lower(email) = any($2::text[])`, [orgId, links.map((l) => l.email)]);
      for (let i = 0; i < links.length; i += 200) {
        const part = links.slice(i, i + 200);
        const values = part.map((_, j) => `($1, $${j * 3 + 4}, $${j * 3 + 5}, $${j * 3 + 6}, $2, now() + make_interval(days => ${INVITE_DAYS}), $3)`);
        await q(
          `insert into invitations (org_id, email, role, token_hash, invited_by, expires_at, batch_id) values ${values.join(", ")}`,
          [orgId, userId, batchId, ...part.flatMap((l) => [l.email, l.role, hashToken(l.token)])],
        );
      }
    });
    revalidatePath("/organization");

    const inviter = await queryOne<{ name: string; email: string }>(`select coalesce(name, email) as name, email from users where id = $1`, [userId]);
    after(async () => {
      const mails = links.map((l) =>
        inviteEmail({ to: l.email, url: `${appUrl()}/join/${l.token}`, role: l.role, org: orgName, inviter: inviter?.name ?? orgName, inviterEmail: inviter?.email ?? "" }),
      );
      const ok = await sendEmailBatch(mails);
      const sentEmails = links.filter((_, i) => ok[i]).map((l) => l.email);
      if (sentEmails.length) {
        await query(`update invitations set emailed_at = now() where batch_id = $1 and lower(email) = any($2::text[])`, [batchId, sentEmails]);
      }
      // Done marker for the progress bar, even if some failed.
      await query(`update invitations set emailed_at = coalesce(emailed_at, 'epoch') where batch_id = $1`, [batchId]);
      await logEvent("org.bulk_invite", `Bulk invite: ${sentEmails.length} of ${links.length} emailed (${orgName})`, {
        level: sentEmails.length < links.length ? "warn" : "info",
        meta: { org: orgId, batch: batchId, total: links.length, sent: sentEmails.length },
      });
    });
    return { batchId, total: links.length };
  });
}

/** Progress of a bulk send: how many invites are emailed so far, and whether it's finished. */
export async function bulkInviteProgress(batchId: string): Promise<ActionResult<{ total: number; emailed: number; failed: number; done: boolean }>> {
  return toActionResult(async () => {
    const { orgId } = await requireAdmin();
    const r = await queryOne<{ total: number; emailed: number; failed: number; done: boolean }>(
      `select count(*)::int as total,
              count(*) filter (where emailed_at > 'epoch')::int as emailed,
              count(*) filter (where emailed_at = 'epoch')::int as failed,
              bool_and(emailed_at is not null) as done
         from invitations where org_id = $1 and batch_id = $2`,
      [orgId, batchId],
    );
    return { total: r?.total ?? 0, emailed: r?.emailed ?? 0, failed: r?.failed ?? 0, done: Boolean(r?.done) };
  });
}

/* ------------------------------------------------------------------ */
/* Team join link: one secret link, limited to the organization's      */
/* email domains; everyone joins as Member, while seats last.          */
/* ------------------------------------------------------------------ */

export async function saveTeamLink(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const action = formData.get("action")?.toString();
  if (action === "off") {
    await query(`update organizations set join_token_hash = null where id = $1`, [orgId]);
    await logEvent("org.team_link_off", "Team join link turned off", { meta: { org: orgId, by: userId } });
    revalidatePath("/organization");
    redirect("/organization?saved=team-link-off#team-link");
  }
  await assertCanWrite();
  const { domains, rejected } = parseJoinDomains(formData.get("domains")?.toString() ?? "");
  if (rejected.some((d) => PUBLIC_EMAIL_DOMAINS.has(d))) redirect("/organization?error=team-link-public#team-link");
  if (!domains.length) redirect("/organization?error=team-link-domains#team-link");
  const token = randomBytes(24).toString("base64url");
  await query(`update organizations set join_token_hash = $2, join_domains = $3 where id = $1`, [orgId, hashToken(token), domains]);
  await logEvent("org.team_link_on", `Team join link ${action === "new" ? "replaced" : "turned on"} for ${domains.join(", ")}`, {
    meta: { org: orgId, by: userId },
  });
  revalidatePath("/organization");
  // The link is shown once (only its hash is stored); the page reads it from this short-lived cookie-free param.
  redirect(`/organization?saved=team-link&link=${encodeURIComponent(token)}#team-link`);
}

/** Someone opening the team link joins as Member, if their email's domain is allowed and a seat is free. */
export async function joinWithTeamLink(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const token = formData.get("token")?.toString() ?? "";
  const back = (error: string) => redirect(`/join/team/${encodeURIComponent(token)}?error=${error}`);
  if (formData.get("agree") !== "on") back("agree");
  const org = await queryOne<{ id: string; domains: string[] | null; suspended: boolean }>(
    `select id, join_domains as domains, suspended_at is not null as suspended from organizations where join_token_hash = $1`,
    [hashToken(token)],
  );
  if (!org || org.suspended) back("invalid");
  const me = await queryOne<{ email: string }>(`select email from users where id = $1`, [userId]);
  if (!me || !(org!.domains ?? []).includes(emailDomain(me.email))) back("domain");
  const existing = await getMembership();
  if (existing?.active && existing.orgId === org!.id) redirect("/");
  if (existing && existing.orgId !== org!.id) back("other-org");
  try {
    await assertSeatAvailable(org!.id);
  } catch (err) {
    if (err instanceof SeatLimitError) back("seats");
    throw err;
  }
  await transaction(async (q) => {
    await q(
      `insert into memberships (org_id, user_id, role) values ($1, $2, 'case_manager')
       on conflict (org_id, user_id) do update set active = true, deactivated_at = null`,
      [org!.id, userId],
    );
    // Any invite they also had is used up now.
    await q(`update invitations set accepted_at = now(), accepted_by = $2 where org_id = $1 and lower(email) = lower($3) and accepted_at is null`, [
      org!.id,
      userId,
      me!.email,
    ]);
  });
  await recordAcceptance(userId, "membership", org!.id);
  await logEvent("org.joined_by_link", "Joined with the team link", { email: me!.email, meta: { org: org!.id } });
  revalidatePath("/", "layout");
  await syncOrgSeats(org!.id);
  redirect("/organization/clients?joined=1");
}

/* ------------------------------------------------------------------ */
/* Change several members' roles at once.                              */
/* ------------------------------------------------------------------ */

export async function bulkChangeRole(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const role = formData.get("role")?.toString();
  if (!isOrgRole(role)) redirect("/organization?error=role");
  const ids = formData
    .getAll("user_id")
    .map((v) => v.toString())
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v) && v !== userId)
    .slice(0, 1000);
  if (!ids.length) redirect("/organization?error=bulk-none#staff");
  // An organization always keeps at least one active admin (the person doing this stays admin: they're excluded above).
  const rows = await query<{ user_id: string }>(
    `update memberships set role = $1 where org_id = $2 and active and user_id = any($3::uuid[]) returning user_id`,
    [role, orgId, ids],
  );
  await logEvent("org.bulk_role", `Changed ${rows.length} roles to ${ROLE_LABELS[role as OrgRole]}`, { meta: { org: orgId, by: userId } });
  revalidatePath("/organization");
  redirect(`/organization?saved=bulk-role&n=${rows.length}#staff`);
}
