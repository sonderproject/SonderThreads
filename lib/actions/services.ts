"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { actorQuery } from "@/lib/db/scope";
import { assertCanWrite } from "@/lib/billing";
import { listServices, scopeFilter, serviceScope, type Service } from "@/lib/services";
import { parseMoney } from "@/lib/money";
import { toActionResult, type ActionResult } from "@/lib/validation";

const MAX_SERVICES = 100;

async function manageable() {
  const scope = await serviceScope();
  if (!scope.canManage) throw new Error("Only your organization's admins can change the services list.");
  await assertCanWrite();
  return scope;
}

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!n) throw new Error("Give the service a name.");
  return n;
}

function cleanPrice(price: string | null | undefined): number | null {
  const cents = parseMoney(price);
  if (cents !== null && (Number.isNaN(cents) || cents > 100000000)) {
    throw new Error("Enter a price like 45 or 45.50, or leave it blank.");
  }
  return cents;
}

function refresh() {
  revalidatePath("/settings/services");
  revalidatePath("/check-ins");
  revalidatePath("/people", "layout");
}

/** The active services list, for pickers in the browser. */
export async function getServices(): Promise<Service[]> {
  return listServices();
}

export async function addService(params: { name: string; price?: string | null }): Promise<ActionResult<Service>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const name = cleanName(params.name);
    const priceCents = cleanPrice(params.price);
    const info = await queryOne<{ n: number; dupe: boolean | null; pos: number }>(
      `select count(*) filter (where archived_at is null)::int as n,
              bool_or(archived_at is null and lower(name) = lower($2)) as dupe,
              coalesce(max(position), 0) + 1 as pos
         from services where ${where}`,
      [param, name],
    );
    if (info?.dupe) throw new Error(`"${name}" is already on the list.`);
    if ((info?.n ?? 0) >= MAX_SERVICES) throw new Error(`You can have up to ${MAX_SERVICES} services.`);
    const row = await queryOne<{ id: string }>(
      `insert into services (org_id, user_id, name, price_cents, position) values ($1, $2, $3, $4, $5) returning id`,
      [scope.orgId, scope.orgId ? null : scope.userId, name, priceCents, info?.pos ?? 1],
    );
    refresh();
    return { id: row!.id, name, priceCents, archived: false };
  });
}

export async function updateService(id: string, params: { name: string; price?: string | null }): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const name = cleanName(params.name);
    const dupe = await queryOne(
      `select 1 from services where ${where} and archived_at is null and lower(name) = lower($2) and id <> $3`,
      [param, name, id],
    );
    if (dupe) throw new Error(`"${name}" is already on the list.`);
    const updated = await queryOne<{ id: string }>(
      `update services set name = $2, price_cents = $3 where ${where} and id = $4 returning id`,
      [param, name, cleanPrice(params.price), id],
    );
    // Past visits carry the service's name as their reason; keep them in step so reports don't split one service in two.
    if (updated) {
      // As the admin, so the activity log shows who renamed it.
      await actorQuery(scope.userId, `update check_ins set reason = $2 where service_id = $1 and reason is distinct from $2`, [id, name]);
    }
    refresh();
    return null;
  });
}

/** Retire (or bring back) a service. Its history stays in reports. */
export async function setServiceArchived(id: string, archived: boolean): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    if (!archived) {
      const row = await queryOne<{ name: string }>(`select name from services where ${where} and id = $2`, [param, id]);
      const clash = row
        ? await queryOne(`select 1 from services where ${where} and archived_at is null and lower(name) = lower($2) and id <> $3`, [
            param,
            row.name,
            id,
          ])
        : null;
      if (clash) throw new Error(`There's already an active service called "${row!.name}".`);
    }
    await query(`update services set archived_at = ${archived ? "now()" : "null"} where ${where} and id = $2`, [param, id]);
    refresh();
    return null;
  });
}

/** Move a service up or down the list (the order pickers and kiosk buttons show). */
export async function moveService(id: string, direction: -1 | 1): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const rows = await query<{ id: string }>(
      `select id from services where ${where} and archived_at is null order by position, lower(name)`,
      [param],
    );
    const i = rows.findIndex((r) => r.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= rows.length) return null;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [pos, r] of rows.entries()) {
      await query(`update services set position = $3 where ${where} and id = $2`, [param, r.id, pos + 1]);
    }
    refresh();
    return null;
  });
}
