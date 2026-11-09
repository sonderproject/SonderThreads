"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { queryOne, transaction } from "@/lib/db/client";
import { asUser } from "@/lib/db/as-user";
import { requireUserId } from "@/lib/current-user";
import { hashToken } from "@/lib/session";
import { getMembership, isOrgRole, type OrgRole } from "@/lib/org";
import { transferOrgClients } from "@/lib/org-admin";
import { toActionResult, type ActionResult } from "@/lib/validation";
import { notify } from "@/lib/notify";

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
  if (await getMembership()) redirect("/organization");
  await transaction(async (q) => {
    const res = (await q(`insert into organizations (name, created_by) values ($1, $2) returning id`, [name, userId])) as {
      rows: { id: string }[];
    };
    await q(`insert into memberships (org_id, user_id, role) values ($1, $2, 'admin')`, [res.rows[0].id, userId]);
  });
  revalidatePath("/", "layout");
  redirect("/organization/clients?new=1");
}

/** Admin: makes a one-time invite link for an email address and role. */
export async function createInvite(email: string, role: string): Promise<ActionResult<{ link: string }>> {
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
    const token = randomBytes(32).toString("base64url");
    await asUser(userId, async (q) => {
      // A new invite replaces any earlier unused one for the same address.
      await q(`delete from invitations where org_id = $1 and lower(email) = $2 and accepted_at is null`, [orgId, clean]);
      await q(
        `insert into invitations (org_id, email, role, token_hash, invited_by, expires_at)
         values ($1, $2, $3, $4, $5, now() + make_interval(days => $6))`,
        [orgId, clean, role, hashToken(token), userId, INVITE_DAYS],
      );
    });
    revalidatePath("/organization");
    return { link: `/join/${token}` };
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

  await transaction(async (q) => {
    await q(
      `insert into memberships (org_id, user_id, role) values ($1, $2, $3)
       on conflict (org_id, user_id) do update set role = excluded.role, active = true, deactivated_at = null`,
      [invite!.org_id, userId, invite!.role],
    );
    await q(`update invitations set accepted_at = now(), accepted_by = $2 where id = $1`, [invite!.id, userId]);
  });
  revalidatePath("/", "layout");
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
  revalidatePath("/", "layout");
  redirect("/organization?saved=deactivated");
}

/** Admin: lets a deactivated member back in (with no clients until some are assigned). */
export async function reactivateMember(formData: FormData): Promise<void> {
  const { userId, orgId } = await requireAdmin();
  const target = formData.get("user_id")?.toString() ?? "";
  await asUser(userId, (q) =>
    q(`update memberships set active = true, deactivated_at = null where org_id = $1 and user_id = $2`, [orgId, target]),
  );
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
