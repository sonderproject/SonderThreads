import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";

export * from "@/lib/org-roles";
import type { OrgRole } from "@/lib/org-roles";

export type Membership = { orgId: string; orgName: string; role: OrgRole; active: boolean };

/** The signed-in person's organization, or null for a solo account. */
export async function getMembership(): Promise<Membership | null> {
  const userId = await requireUserId();
  const row = await queryOne<{ org_id: string; name: string; role: OrgRole; active: boolean }>(
    `select m.org_id, o.name, m.role, m.active
       from memberships m join organizations o on o.id = m.org_id
      where m.user_id = $1`,
    [userId],
  );
  return row ? { orgId: row.org_id, orgName: row.name, role: row.role, active: row.active } : null;
}

export type PendingInvite = { id: string; orgName: string; role: OrgRole; inviter: string | null };

/** Invites waiting for the signed-in person (matched on their account email), newest first. */
export async function getPendingInvites(): Promise<PendingInvite[]> {
  const userId = await requireUserId();
  const { query } = await import("@/lib/db/client");
  const rows = await query<{ id: string; org_name: string; role: OrgRole; inviter: string | null }>(
    `select i.id, o.name as org_name, i.role, coalesce(u.name, u.email) as inviter
       from invitations i
       join organizations o on o.id = i.org_id
       left join users u on u.id = i.invited_by
       join users me on me.id = $1
      where lower(i.email) = lower(me.email) and i.accepted_at is null and i.expires_at > now()
        and not exists (select 1 from memberships m where m.user_id = $1 and m.org_id = i.org_id and m.active)
      order by i.created_at desc`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id, orgName: r.org_name, role: r.role, inviter: r.inviter }));
}
