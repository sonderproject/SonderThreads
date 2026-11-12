import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { mineOrOrg } from "@/lib/db/scope";

/**
 * Services: what a business or agency provides (Settings → Services). An
 * organization shares one list that its admins manage; a solo account has
 * its own. Picking one when logging a check-in/meeting records what was
 * provided and for how much.
 */
export type Service = { id: string; name: string; priceCents: number | null; archived: boolean };

export type ServiceScope = { userId: string; orgId: string | null; canManage: boolean };

export async function serviceScope(): Promise<ServiceScope> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (m?.active) return { userId, orgId: m.orgId, canManage: m.role === "admin" };
  return { userId, orgId: null, canManage: true };
}

/** SQL filter for the scope's list: `$1` = org id or user id. */
export function scopeFilter(scope: ServiceScope): { where: string; param: string } {
  return scope.orgId ? { where: "org_id = $1", param: scope.orgId } : { where: "org_id is null and user_id = $1", param: scope.userId };
}

type Row = { id: string; name: string; price_cents: number | null; archived_at: string | null };

export async function listServices(opts: { includeArchived?: boolean } = {}): Promise<Service[]> {
  const scope = await serviceScope();
  const { where, param } = scopeFilter(scope);
  const rows = await query<Row>(
    `select id, name, price_cents, archived_at from services
      where ${where} ${opts.includeArchived ? "" : "and archived_at is null"}
      order by archived_at nulls first, position, lower(name)`,
    [param],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, priceCents: r.price_cents, archived: r.archived_at !== null }));
}

/** An active service in the signed-in person's list, or null. */
export async function findService(id: string): Promise<Service | null> {
  const scope = await serviceScope();
  const { where, param } = scopeFilter(scope);
  const r = await queryOne<Row>(
    `select id, name, price_cents, archived_at from services where ${where} and id = $2 and archived_at is null`,
    [param, id],
  );
  return r ? { id: r.id, name: r.name, priceCents: r.price_cents, archived: false } : null;
}

/** Which services each visible person has ever had: { personId: [serviceId, ...] }, for filtering People. */
export async function peopleServiceIds(): Promise<Record<string, string[]>> {
  const userId = await requireUserId();
  const rows = await query<{ person_id: string; ids: string[] }>(
    `select c.person_id, array_agg(distinct c.service_id::text) as ids
       from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
      where ${mineOrOrg("$1", "p.")} and c.deleted_at is null and c.service_id is not null
      group by c.person_id`,
    [userId],
  );
  return Object.fromEntries(rows.map((r) => [r.person_id, r.ids]));
}
