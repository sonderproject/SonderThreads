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
