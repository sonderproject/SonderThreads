"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, transaction } from "@/lib/db/client";
import { mineOrOrg } from "@/lib/db/scope";
import { requireUserId } from "@/lib/current-user";
import { assertCanWrite } from "@/lib/billing";
import { scopeFilter, serviceScope } from "@/lib/services";
import { logActivity } from "@/lib/actions/activity";
import { toActionResult, type ActionResult } from "@/lib/validation";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export type ServiceRecipient = {
  checkInId: string;
  personId: string;
  name: string;
  at: string;
  amountCents: number | null;
  loggedBy: string | null;
};

/**
 * Every time a service was provided in a date range (each check-in with it), newest first, with
 * who got it. The same people the signed-in person can see elsewhere (their own, and their
 * organization's clients).
 */
export async function listServiceRecipients(serviceId: string, from: string, to: string, tz: string): Promise<ServiceRecipient[]> {
  const userId = await requireUserId();
  if (!DAY.test(from) || !DAY.test(to)) return [];
  const service = await serviceInScope(serviceId);
  if (!service) return [];
  return query<ServiceRecipient>(
    `select c.id as "checkInId", p.id as "personId", p.display_name as name, c.checked_in_at as at,
            c.amount_cents as "amountCents", coalesce(u.name, u.email) as "loggedBy"
       from check_ins c
       join people p on p.id = c.person_id and p.deleted_at is null
       left join users u on u.id = c.user_id
      where ${mineOrOrg("$1", "c.")} and c.deleted_at is null and c.service_id = $2
        and (c.checked_in_at at time zone $5)::date between $3::date and $4::date
      order by c.checked_in_at desc
      limit 5000`,
    [userId, service.id, from, to, tz],
  );
}

/** Saves everyone who got the service in the range as a new list or group (each person once). */
export async function saveServicePeopleAsList(params: {
  serviceId: string;
  from: string;
  to: string;
  tz: string;
  name: string;
  isGroup: boolean;
}): Promise<ActionResult<{ listId: string; count: number }>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const name = params.name.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!name) throw new Error("Give the list a name.");
    const rows = await listServiceRecipients(params.serviceId, params.from, params.to, params.tz);
    const people = [...new Map(rows.map((r) => [r.personId, r.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    if (people.length === 0) throw new Error("Nobody got this service in these dates.");
    if (people.length > 2000) throw new Error("That's more than 2,000 people. Pick a shorter date range.");
    const listId = await transaction(async (q) => {
      const res = (await q(
        `insert into lists (user_id, name, description, is_group) values ($1, $2, $3, $4) returning id`,
        [userId, name, `Everyone who got this service from ${params.from} to ${params.to}.`, params.isGroup],
      )) as { rows: { id: string }[] };
      const list = res.rows[0];
      for (let i = 0; i < people.length; i += 500) {
        const part = people.slice(i, i + 500);
        const values = part.map((_, j) => `($1, $2, $${j * 3 + 3}, $${j * 3 + 4}, $${j * 3 + 5})`);
        await q(
          `insert into list_items (user_id, list_id, person_id, label, position) values ${values.join(", ")}`,
          [userId, list.id, ...part.flatMap(([id, label], j) => [id, label, i + j])],
        );
      }
      return list.id;
    });
    await logActivity({ type: "list_created", description: `${params.isGroup ? "Group" : "List"} "${name}" created from a service`, listId });
    revalidatePath("/lists");
    revalidatePath("/", "layout");
    return { listId, count: people.length };
  });
}

/** A service on the signed-in person's list, including retired ones (their history still counts). */
export async function serviceInScope(id: string): Promise<{ id: string; name: string; archived: boolean } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { where, param } = scopeFilter(await serviceScope());
  const r = await queryOne<{ id: string; name: string; archived: boolean }>(
    `select id, name, archived_at is not null as archived from services where ${where} and id = $2`,
    [param, id],
  );
  return r;
}
