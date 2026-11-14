"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { actorQuery, actorQueryOne } from "@/lib/db/scope";
import { requireUserId } from "@/lib/current-user";
import { assertCanWrite } from "@/lib/billing";
import { getPerson } from "@/lib/actions/people";
import { logActivity } from "@/lib/actions/activity";
import { scopeFilter } from "@/lib/services";
import { findOutcome, outcomeScope, type Outcome } from "@/lib/outcomes";
import { toActionResult, type ActionResult } from "@/lib/validation";

const MAX_OUTCOMES = 50;

async function manageable() {
  const scope = await outcomeScope();
  if (!scope.canManage) throw new Error("Only your organization's admins can change the outcomes list.");
  await assertCanWrite();
  return scope;
}

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!n) throw new Error("Give the outcome a name.");
  return n;
}

function refresh() {
  revalidatePath("/settings/outcomes");
  revalidatePath("/impact");
  revalidatePath("/people", "layout");
}

// ---- The list (Settings → Outcomes) ----

export async function addOutcome(params: { name: string }): Promise<ActionResult<Outcome>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const name = cleanName(params.name);
    const info = await queryOne<{ n: number; dupe: boolean | null; pos: number }>(
      `select count(*) filter (where archived_at is null)::int as n,
              bool_or(archived_at is null and lower(name) = lower($2)) as dupe,
              coalesce(max(position), 0) + 1 as pos
         from outcomes where ${where}`,
      [param, name],
    );
    if (info?.dupe) throw new Error(`"${name}" is already on the list.`);
    if ((info?.n ?? 0) >= MAX_OUTCOMES) throw new Error(`You can have up to ${MAX_OUTCOMES} outcomes.`);
    const row = await queryOne<{ id: string }>(
      `insert into outcomes (org_id, user_id, name, position) values ($1, $2, $3, $4) returning id`,
      [scope.orgId, scope.orgId ? null : scope.userId, name, info?.pos ?? 1],
    );
    refresh();
    return { id: row!.id, name, archived: false };
  });
}

export async function renameOutcome(id: string, params: { name: string }): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const name = cleanName(params.name);
    const dupe = await queryOne(`select 1 from outcomes where ${where} and archived_at is null and lower(name) = lower($2) and id <> $3`, [param, name, id]);
    if (dupe) throw new Error(`"${name}" is already on the list.`);
    await query(`update outcomes set name = $2 where ${where} and id = $3`, [param, name, id]);
    refresh();
    return null;
  });
}

/** Retire (or bring back) an outcome. What was recorded stays in reports. */
export async function setOutcomeArchived(id: string, archived: boolean): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    if (!archived) {
      const row = await queryOne<{ name: string }>(`select name from outcomes where ${where} and id = $2`, [param, id]);
      const clash = row
        ? await queryOne(`select 1 from outcomes where ${where} and archived_at is null and lower(name) = lower($2) and id <> $3`, [param, row.name, id])
        : null;
      if (clash) throw new Error(`There's already an active outcome called "${row!.name}".`);
    }
    await query(`update outcomes set archived_at = ${archived ? "now()" : "null"} where ${where} and id = $2`, [param, id]);
    refresh();
    return null;
  });
}

export async function moveOutcome(id: string, direction: -1 | 1): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const rows = await query<{ id: string }>(`select id from outcomes where ${where} and archived_at is null order by position, lower(name)`, [param]);
    const i = rows.findIndex((r) => r.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= rows.length) return null;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [pos, r] of rows.entries()) await query(`update outcomes set position = $3 where ${where} and id = $2`, [param, r.id, pos + 1]);
    refresh();
    return null;
  });
}

// ---- On a person ----

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Records that a person reached an outcome (today unless a date is given). Anyone who can see the person can. */
export async function recordOutcome(params: { personId: string; outcomeId: string; achievedOn?: string | null; note?: string | null }): Promise<ActionResult<{ id: string }>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const person = await getPerson(params.personId);
    if (!person) throw new Error("Person not found.");
    const outcome = await findOutcome(params.outcomeId);
    if (!outcome) throw new Error("That outcome isn't on your list anymore.");
    const day = params.achievedOn && DATE_RE.test(params.achievedOn) ? params.achievedOn : null;
    if (day && (day > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) || day < "2000-01-01")) throw new Error("Pick a date that isn't in the future.");
    const note = params.note?.trim().slice(0, 500) || null;
    const row = await actorQueryOne<{ id: string }>(
      userId,
      // Today in the person's own time zone when no date is given.
      `insert into person_outcomes (user_id, person_id, outcome_id, achieved_on, note)
       values ($1, $2, $3, coalesce($4::date, (now() at time zone coalesce((select timezone from users where id = $1), 'UTC'))::date), $5)
       returning id`,
      [userId, person.id, outcome.id, day, note],
    );
    await logActivity({ type: "outcome", description: `Outcome: ${outcome.name}`, personId: person.id });
    revalidatePath(`/people/${person.id}`);
    revalidatePath("/impact");
    return { id: row!.id };
  });
}

/** Removes a recorded outcome (by whoever recorded it, or an organization admin). */
export async function removePersonOutcome(id: string): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const rows = await actorQuery<{ person_id: string }>(
      userId,
      `update person_outcomes po set deleted_at = now()
        where po.id = $2 and po.deleted_at is null
          and (po.user_id = $1 or exists (select 1 from memberships m where m.user_id = $1 and m.org_id = po.org_id and m.active and m.role = 'admin'))
        returning po.person_id`,
      [userId, id],
    );
    if (!rows.length) throw new Error("Only the person who recorded it, or an admin, can remove it.");
    revalidatePath(`/people/${rows[0].person_id}`);
    revalidatePath("/impact");
    return null;
  });
}
