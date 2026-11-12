"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query, queryOne, transaction } from "@/lib/db/client";
import { isValidTimeZone } from "@/lib/tz";
import { asUser } from "@/lib/db/as-user";
import { requireUserId } from "@/lib/current-user";
import { hashToken } from "@/lib/session";
import { getMembership, isOrgRole, type OrgRole } from "@/lib/org";
import { transferOrgClients } from "@/lib/org-admin";
import { toActionResult, type ActionResult } from "@/lib/validation";
import { recordAcceptance } from "@/lib/legal-server";
import { notify } from "@/lib/notify";
import { appUrl, emailConfigured, escapeHtml, sendEmail } from "@/lib/email";
import { ROLE_LABELS } from "@/lib/org-roles";
import { SeatLimitError, assertSeatAvailable, billingEnabled, syncOrgSeats } from "@/lib/billing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_DAYS = 14;

async function requireAdmin(): Promise<{ userId: string; orgId: string }> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m || !m.active || m.role !== "admin") throw new Error("Only an organization admin can do that.");
  return { userId, orgId: m.orgId };
}

/** Settings → Set up an organization: creates it with you as its admin. */
export async function createOrganization(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = (formData.get("name")?.toString() ?? "").trim().slice(0, 200);
  if (!name) redirect("/organization/new?error=name");
  if (formData.get("agree") !== "on") redirect("/organization/new?error=agree");
  if (await getMembership()) redirect("/organization");
  const orgId = await transaction(async (q) => {
    const res = (await q(`insert into organizations (name, created_by) values ($1, $2) returning id`, [name, userId])) as {
      rows: { id: string }[];
    };
    await q(`insert into memberships (org_id, user_id, role) values ($1, $2, 'admin')`, [res.rows[0].id, userId]);
    return res.rows[0].id;
  });
  await recordAcceptance(userId, "organization", orgId);
  revalidatePath("/", "layout");
  // New organizations start their free trial with a card first (lib/billing.ts), then bring clients in.
  redirect(billingEnabled() ? "/billing?org=new" : "/organization/clients?new=1");
}

/** Admin: makes a one-time invite link for an email address and role, and emails it when email is set up. */
export async function createInvite(email: string, role: string): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  return toActionResult(async () => {
    const { userId, orgId } = await requireAdmin();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean) || clean.length > 254) throw new Error("Enter a valid email address.");
    if (!isOrgRole(role)) throw new Error("Choose a role.");
    const member = await queryOne(
      `select 1 from memberships m join users u on u.id = m.user_id where m.org_id = $1 and lower(u.email) = $2 and m.active`,
      [orgId, clean],
    );
    if (member) throw new Error("That person is already in your organization.");
    // Cap invite emails so a compromised admin account can't spam through our sender.
    const recent = await queryOne<{ n: number }>(
      `select count(*)::int n from invitations where org_id = $1 and created_at > now() - interval '1 hour'`,
      [orgId],
    );
    if ((recent?.n ?? 0) >= 30) throw new Error("That's a lot of invites in one hour. Please try again a little later.");
    const replacing = await queryOne(
      `select 1 from invitations where org_id = $1 and lower(email) = $2 and accepted_at is null and expires_at > now()`,
      [orgId, clean],
    );
    await assertSeatAvailable(orgId, { replacingInvite: Boolean(replacing) });
    const token = randomBytes(32).toString("base64url");
    await transaction(async (q) => {
      // A new invite replaces any earlier unused one for the same address.
      await q(`delete from invitations where org_id = $1 and lower(email) = $2 and accepted_at is null`, [orgId, clean]);
      await q(
        `insert into invitations (org_id, email, role, token_hash, invited_by, expires_at)
         values ($1, $2, $3, $4, $5, now() + make_interval(days => $6))`,
        [orgId, clean, role, hashToken(token), userId, INVITE_DAYS],
      );
    });
    revalidatePath("/organization");
    const link = `/join/${token}`;
    await notifyInvitee(clean, orgId, userId);
    const emailed = await sendInviteEmail(clean, `${appUrl()}${link}`, role, userId, orgId);
    return { link, emailed };
  });
}

/** Admin: cancels an unused invite. */
export async function revokeInvite(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const id = formData.get("id")?.toString() ?? "";
  await asUser(userId, (q) => q(`delete from invitations where id = $1 and org_id = $2 and accepted_at is null`, [id, orgId]));
  revalidatePath("/organization");
}

/** The invited person accepts: joins the organization with the invited role. */
export async function acceptInvite(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const token = formData.get("token")?.toString() ?? "";
  const back = (error: string) => redirect(`/join/${encodeURIComponent(token)}?error=${error}`);
  if (formData.get("agree") !== "on") back("agree");
  const invite = await queryOne<{ id: string; org_id: string; email: string; role: OrgRole; expired: boolean; accepted: boolean }>(
    `select id, org_id, email, role, expires_at < now() as expired, accepted_at is not null as accepted
       from invitations where token_hash = $1`,
    [hashToken(token)],
  );
  if (!invite) back("invalid");
  if (invite!.accepted) back("used");
  if (invite!.expired) back("expired");
  const me = await queryOne<{ email: string }>(`select email from users where id = $1`, [userId]);
  if (me?.email.toLowerCase() !== invite!.email.toLowerCase()) back("email");
  const existing = await getMembership();
  if (existing && existing.orgId !== invite!.org_id) back("other-org");
  if (!(await seatFree(invite!.org_id, existing?.orgId === invite!.org_id && existing.active))) back("seats");

  await transaction(async (q) => {
    await q(
      `insert into memberships (org_id, user_id, role) values ($1, $2, $3)
       on conflict (org_id, user_id) do update set role = excluded.role, active = true, deactivated_at = null`,
      [invite!.org_id, userId, invite!.role],
    );
    await q(`update invitations set accepted_at = now(), accepted_by = $2 where id = $1`, [invite!.id, userId]);
  });
  await recordAcceptance(userId, "membership", invite!.org_id);
  revalidatePath("/", "layout");
  await syncOrgSeats(invite!.org_id);
  redirect("/organization/clients?joined=1");
}

/** A member moves some of their existing (personal) clients into the organization. */
export async function moveClientsToOrg(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active) redirect("/settings");
  const ids = formData.getAll("person_id").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  if (ids.length > 0) {
    // As the user: the database itself checks they own each client and belong to the org.
    await asUser(userId, (q) =>
      q(`update people set org_id = $1 where user_id = $2 and org_id is null and id = any($3::uuid[])`, [m!.orgId, userId, ids]),
    );
  }
  revalidatePath("/", "layout");
  redirect(`/organization/clients?moved=${ids.length}`);
}

/** Admin: changes someone's role. An organization always keeps at least one active admin. */
export async function changeRole(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const target = formData.get("user_id")?.toString() ?? "";
  const role = formData.get("role")?.toString();
  if (!isOrgRole(role)) redirect("/organization?error=role");
  if (role !== "admin") {
    const admins = await queryOne<{ n: number }>(
      `select count(*)::int n from memberships where org_id = $1 and active and role = 'admin' and user_id <> $2`,
      [orgId, target],
    );
    if (!admins?.n) redirect("/organization?error=last-admin");
  }
  await asUser(userId, (q) => q(`update memberships set role = $1 where org_id = $2 and user_id = $3`, [role, orgId, target]));
  revalidatePath("/organization");
  redirect("/organization?saved=role");
}

/**
 * Admin: deactivates a member. They lose access to the organization right
 * away, and their organization clients (with notes, tasks, check-ins) go to
 * the chosen staff member. Their personal records stay theirs.
 */
export async function deactivateMember(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const target = formData.get("user_id")?.toString() ?? "";
  const to = formData.get("to_user_id")?.toString() ?? "";
  if (target === userId) redirect("/organization?error=self");
  const valid = await queryOne<{ ok: boolean }>(
    `select exists (select 1 from memberships where org_id = $1 and user_id = $2 and active) and
            exists (select 1 from memberships where org_id = $1 and user_id = $3 and active) and $2 <> $3 as ok`,
    [orgId, target, to],
  );
  if (!valid?.ok) redirect("/organization?error=reassign");
  const admins = await queryOne<{ n: number }>(
    `select count(*)::int n from memberships where org_id = $1 and active and role = 'admin' and user_id <> $2`,
    [orgId, target],
  );
  if (!admins?.n) redirect("/organization?error=last-admin");
  await transaction(async (q) => {
    await transferOrgClients(q, orgId, target, to);
    await q(`update memberships set active = false, deactivated_at = now() where org_id = $1 and user_id = $2`, [orgId, target]);
  });
  await syncOrgSeats(orgId);
  revalidatePath("/", "layout");
  redirect("/organization?saved=deactivated");
}

/** Admin: lets a deactivated member back in (with no clients until some are assigned). */
export async function reactivateMember(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const target = formData.get("user_id")?.toString() ?? "";
  try {
    await assertSeatAvailable(orgId);
  } catch (err) {
    if (err instanceof SeatLimitError) redirect("/organization?error=seats");
    throw err;
  }
  await asUser(userId, (q) =>
    q(`update memberships set active = true, deactivated_at = null where org_id = $1 and user_id = $2`, [orgId, target]),
  );
  await syncOrgSeats(orgId);
  revalidatePath("/organization");
  redirect("/organization?saved=reactivated");
}

/** Admin: edits the organization's name and contact details. */
export async function saveOrganizationInfo(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const field = (key: string, max: number) => (formData.get(key)?.toString() ?? "").trim().slice(0, max) || null;
  const name = field("name", 200);
  if (!name) redirect("/organization?error=name#info");
  const email = field("email", 254);
  if (email && !EMAIL_RE.test(email)) redirect("/organization?error=org-email#info");
  let website = field("website", 300);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  await asUser(userId, (q) =>
    q(
      `update organizations set name = $1, phone = $2, email = $3, website = $4, address = $5, about = $6, updated_at = now()
        where id = $7`,
      [name, field("phone", 40), email, website, field("address", 500), field("about", 1000), orgId],
    ),
  );
  revalidatePath("/", "layout");
  redirect("/organization?saved=info#info");
}

/**
 * Supervisor or admin: hands one organization client (with everything
 * attached) to another active staff member, who gets a notification.
 */
export async function reassignClient(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active || m.role === "case_manager") redirect("/");
  const personId = formData.get("person_id")?.toString() ?? "";
  const to = formData.get("to_user_id")?.toString() ?? "";
  // Read through the access rules: only a client of this organization is visible here.
  const [client] = await asUser(userId, (q) =>
    q<{ user_id: string; display_name: string }>(
      `select user_id, display_name from people where id = $1 and org_id = $2 and deleted_at is null`,
      [personId, m!.orgId],
    ),
  ).catch(() => []);
  if (!client) redirect("/team");
  const target = await queryOne(`select 1 from memberships where org_id = $1 and user_id = $2 and active`, [m!.orgId, to]);
  if (!target || to === client.user_id) redirect(`/team/client/${personId}?error=reassign`);

  await transaction((q) => transferOrgClients(q, m!.orgId, client.user_id, to, personId));
  await notify(to, {
    type: "client_assigned",
    title: `${client.display_name} was assigned to you`,
    href: `/people/${personId}`,
    personId,
  }).catch((err) => console.error("[org] assignment notification failed", err));
  revalidatePath("/", "layout");
  redirect(`/team/client/${personId}?saved=reassigned`);
}

/** Supervisor or admin: leaves a comment on a client; the case manager is notified. */
export async function addClientComment(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active || m.role === "case_manager") redirect("/");
  const personId = formData.get("person_id")?.toString() ?? "";
  const body = (formData.get("body")?.toString() ?? "").trim().slice(0, 5000);
  if (!body) redirect(`/team/client/${personId}?error=comment#comments`);
  // As the user: the database checks they're a supervisor/admin of the client's organization.
  const client = await asUser(userId, async (q) => {
    await q(`insert into client_comments (org_id, person_id, author_id, body) values ($1, $2, $3, $4)`, [m!.orgId, personId, userId, body]);
    return (await q<{ user_id: string; display_name: string }>(`select user_id, display_name from people where id = $1`, [personId]))[0];
  }).catch(() => null);
  if (!client) redirect("/team");
  if (client.user_id !== userId) {
    await notify(client.user_id, {
      type: "client_comment",
      title: `New comment on ${client.display_name}`,
      body: body.length > 140 ? `${body.slice(0, 139)}…` : body,
      href: `/people/${personId}#comments`,
      personId,
    }).catch((err) => console.error("[org] comment notification failed", err));
  }
  revalidatePath(`/team/client/${personId}`);
  redirect(`/team/client/${personId}#comments`);
}

/** The invite email. Returns false (and the admin shares the link themselves) if email isn't set up or sending fails. */
async function sendInviteEmail(to: string, url: string, role: OrgRole, inviterId: string, orgId: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  const row = await queryOne<{ org: string; inviter: string; inviter_email: string }>(
    `select o.name as org, coalesce(u.name, u.email) as inviter, u.email as inviter_email
       from organizations o, users u where o.id = $1 and u.id = $2`,
    [orgId, inviterId],
  );
  if (!row) return false;
  const roleName = `${role === "admin" ? "an" : "a"} ${ROLE_LABELS[role].toLowerCase()}`;
  const subject = `${row.inviter} invited you to join ${row.org} on Strynd`;
  const text = [
    `${row.inviter} invited you to join ${row.org} on Strynd as ${roleName}.`,
    "",
    `Accept the invite: ${url}`,
    "",
    `Sign up or sign in with this email address (${to}). The link works once and expires in 14 days.`,
  ].join("\n");
  const html = `<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#141412;max-width:480px">
  <p>${escapeHtml(row.inviter)} invited you to join <strong>${escapeHtml(row.org)}</strong> on Strynd as ${escapeHtml(roleName)}.</p>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c77b5;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:600">Accept the invite</a></p>
  <p style="color:#6e5f4d;font-size:13px">Sign up or sign in with this email address (${escapeHtml(to)}). The link works once and expires in 14 days.</p>
</div>`;
  try {
    await sendEmail({ to, subject, text, html, replyTo: row.inviter_email });
    return true;
  } catch (err) {
    console.error("[org] invite email failed", err instanceof Error ? err.message : err);
    return false;
  }
}

const LOGO_MAX_BYTES = 1024 * 1024;

/** The real file type from its first bytes (never trust the browser's label). PNG and JPEG only. */
function sniffImage(buf: Buffer): "image/png" | "image/jpeg" | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

/** Admin: uploads the organization's logo (PNG or JPEG, up to 1 MB). */
export async function uploadOrgLogo(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const file = formData.get("logo");
  if (!(file instanceof Blob) || file.size === 0) redirect("/organization?error=logo-missing#info");
  if (file.size > LOGO_MAX_BYTES) redirect("/organization?error=logo-size#info");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(buf);
  if (!type) redirect("/organization?error=logo-type#info");
  await asUser(userId, (q) =>
    q(`update organizations set logo = $1, logo_type = $2, logo_updated_at = now(), updated_at = now() where id = $3`, [buf, type, orgId]),
  );
  revalidatePath("/", "layout");
  redirect("/organization?saved=logo#info");
}

/** Admin: removes the organization's logo. */
export async function removeOrgLogo(): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  await asUser(userId, (q) =>
    q(`update organizations set logo = null, logo_type = null, logo_updated_at = null, updated_at = now() where id = $1`, [orgId]),
  );
  revalidatePath("/", "layout");
  redirect("/organization?saved=logo-removed#info");
}

/**
 * Accept an invite from inside the app (no email link needed): the invite
 * must be for the signed-in person's own email address.
 */
export async function acceptInviteInApp(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = formData.get("invite_id")?.toString() ?? "";
  if (formData.get("agree") !== "on") redirect("/?invite=agree");
  const me = await queryOne<{ email: string }>(`select email from users where id = $1`, [userId]);
  const invite = await queryOne<{ id: string; org_id: string; role: OrgRole }>(
    `select id, org_id, role from invitations
      where id = $1 and lower(email) = lower($2) and accepted_at is null and expires_at > now()`,
    [id, me?.email ?? ""],
  );
  if (!invite) redirect("/?invite=invalid");
  const existing = await getMembership();
  if (existing && existing.active && existing.orgId !== invite!.org_id) redirect("/?invite=other-org");
  if (!(await seatFree(invite!.org_id, existing?.orgId === invite!.org_id && existing.active))) redirect("/?invite=seats");
  await transaction(async (q) => {
    await q(
      `insert into memberships (org_id, user_id, role) values ($1, $2, $3)
       on conflict (org_id, user_id) do update set role = excluded.role, active = true, deactivated_at = null`,
      [invite!.org_id, userId, invite!.role],
    );
    await q(`update invitations set accepted_at = now(), accepted_by = $2 where id = $1`, [invite!.id, userId]);
  });
  await recordAcceptance(userId, "membership", invite!.org_id);
  revalidatePath("/", "layout");
  await syncOrgSeats(invite!.org_id);
  redirect("/organization/clients?joined=1");
}

/** Decline an in-app invite (it's removed; the admin can invite again). */
export async function declineInviteInApp(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = formData.get("invite_id")?.toString() ?? "";
  const me = await queryOne<{ email: string }>(`select email from users where id = $1`, [userId]);
  await queryOne(`delete from invitations where id = $1 and lower(email) = lower($2) and accepted_at is null returning id`, [id, me?.email ?? ""]);
  revalidatePath("/", "layout");
  redirect("/");
}

/** Admin: makes a fresh link for a pending invite (the old link stops working), to copy and send yourself. */
export async function newInviteLink(inviteId: string): Promise<ActionResult<{ link: string }>> {
  return toActionResult(async () => {
    const { userId, orgId } = await requireAdmin();
    const token = randomBytes(32).toString("base64url");
    const rows = await asUser(userId, (q) =>
      q(
        `update invitations set token_hash = $1, expires_at = now() + make_interval(days => $2)
          where id = $3 and org_id = $4 and accepted_at is null returning id`,
        [hashToken(token), INVITE_DAYS, inviteId, orgId],
      ),
    );
    if (!rows.length) throw new Error("That invite was already used or removed.");
    revalidatePath("/organization");
    return { link: `/join/${token}` };
  });
}

/** If the invited email already has an account, put the invite in their Notifications (no email needed). */
async function notifyInvitee(email: string, orgId: string, inviterId: string): Promise<void> {
  const row = await queryOne<{ invitee: string; org: string; inviter: string }>(
    `select u.id as invitee, o.name as org, coalesce(me.name, me.email) as inviter
       from users u, organizations o, users me
      where lower(u.email) = lower($1) and o.id = $2 and me.id = $3`,
    [email, orgId, inviterId],
  );
  if (!row) return;
  await notify(row.invitee, {
    type: "org_invite",
    title: `${row.inviter} invited you to join ${row.org}`,
    body: "Tap to see the invite and join.",
    href: "/invites",
    channels: ["push"],
  }).catch((err) => console.error("[org] invite notification failed", err));
}

/** Admin: moves every organization client (and everything attached) from one active member to another, without deactivating anyone. */
export async function reassignAllClients(formData: FormData): Promise<void> {
  const { orgId } = await requireAdmin();
  const from = formData.get("user_id")?.toString() ?? "";
  const to = formData.get("to_user_id")?.toString() ?? "";
  const valid = await queryOne<{ ok: boolean }>(
    `select exists (select 1 from memberships where org_id = $1 and user_id = $2) and
            exists (select 1 from memberships where org_id = $1 and user_id = $3 and active) and $2 <> $3 as ok`,
    [orgId, from, to],
  );
  if (!valid?.ok) redirect("/organization?error=reassign");
  await transaction((q) => transferOrgClients(q, orgId, from, to));
  const toRow = await queryOne<{ n: number }>(`select count(*)::int n from people where user_id = $1 and org_id = $2`, [to, orgId]);
  await notify(to, {
    type: "client_assigned",
    title: "Clients were assigned to you",
    body: `You now have ${toRow?.n ?? 0} clients.`,
    href: "/people",
  }).catch(() => {});
  revalidatePath("/", "layout");
  redirect("/organization?saved=moved");
}

/** Accepting a pending invite: it already holds a seat, so this only fails if seats were cut below what's in use. */
async function seatFree(orgId: string, alreadyMember: boolean): Promise<boolean> {
  if (alreadyMember) return true;
  try {
    await assertSeatAvailable(orgId, { fromPendingInvite: true });
    return true;
  } catch (err) {
    if (err instanceof SeatLimitError) return false;
    throw err;
  }
}

/** Admin: the organization's time zone (reports, exports and referral appointments). */
export async function saveOrgTimeZone(formData: FormData): Promise<void> {
  const { orgId } = await requireAdmin();
  const tz = formData.get("timezone")?.toString() ?? "";
  if (!isValidTimeZone(tz)) redirect("/settings/organization?error=timezone");
  await query(`update organizations set referral_timezone = $2 where id = $1`, [orgId, tz]);
  revalidatePath("/", "layout");
  redirect("/settings/organization?saved=timezone");
}
