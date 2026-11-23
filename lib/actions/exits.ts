"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { actorQuery, actorQueryOne, mineOrOrg } from "@/lib/db/scope";
import { requireUserId } from "@/lib/current-user";
import { assertCanWrite } from "@/lib/billing";
import { getPerson } from "@/lib/actions/people";
import { logActivity } from "@/lib/actions/activity";
import { scopeFilter } from "@/lib/services";
import { exitScope, findExitReason, type ExitReason } from "@/lib/exits";
import { isExitKind, type ExitKind } from "@/lib/exit-kinds";
import { toActionResult, type ActionResult } from "@/lib/validation";

const MAX_REASONS = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function manageable() {
  const scope = await exitScope();
  if (!scope.canManage) throw new Error("Only your organization's admins can change the exit reasons.");
  await assertCanWrite();
  return scope;
}

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!n) throw new Error("Give the reason a name.");
  return n;
}

function refreshList() {
  revalidatePath("/settings/outcomes");
  revalidatePath("/impact");
  revalidatePath("/people", "layout");
}

// ---- The list (Settings → Outcomes & exits) ----

export async function addExitReason(params: { name: string; kind: ExitKind }): Promise<ActionResult<ExitReason>> {
  return toActionResult(async () => {
    const scope = await manageable();
    if (!isExitKind(params.kind)) throw new Error("Pick positive, neutral or unplanned.");
    const { where, param } = scopeFilter(scope);
    const name = cleanName(params.name);
    const info = await queryOne<{ n: number; dupe: boolean | null; pos: number }>(
      `select count(*) filter (where archived_at is null)::int as n,
              bool_or(archived_at is null and lower(name) = lower($2)) as dupe,
              coalesce(max(position), 0) + 1 as pos
         from exit_reasons where ${where}`,
      [param, name],
    );
    if (info?.dupe) throw new Error(`"${name}" is already on the list.`);
    if ((info?.n ?? 0) >= MAX_REASONS) throw new Error(`You can have up to ${MAX_REASONS} exit reasons.`);
    const row = await queryOne<{ id: string }>(
      `insert into exit_reasons (org_id, user_id, name, kind, position) values ($1, $2, $3, $4, $5) returning id`,
      [scope.orgId, scope.orgId ? null : scope.userId, name, params.kind, info?.pos ?? 1],
    );
    refreshList();
    return { id: row!.id, name, kind: params.kind, archived: false };
  });
}

export async function renameExitReason(id: string, params: { name: string }): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const name = cleanName(params.name);
    const dupe = await queryOne(`select 1 from exit_reasons where ${where} and archived_at is null and lower(name) = lower($2) and id <> $3`, [param, name, id]);
    if (dupe) throw new Error(`"${name}" is already on the list.`);
    await query(`update exit_reasons set name = $2 where ${where} and id = $3`, [param, name, id]);
    refreshList();
    return null;
  });
}

/** Moves a reason to another group. Exits already recorded keep the group they had. */
export async function setExitReasonKind(id: string, kind: ExitKind): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    if (!isExitKind(kind)) throw new Error("Pick positive, neutral or unplanned.");
    const { where, param } = scopeFilter(scope);
    await query(`update exit_reasons set kind = $2 where ${where} and id = $3`, [param, kind, id]);
    refreshList();
    return null;
  });
}

/** Retire (or bring back) a reason. Exits already recorded stay in reports. */
export async function setExitReasonArchived(id: string, archived: boolean): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    if (!archived) {
      const row = await queryOne<{ name: string }>(`select name from exit_reasons where ${where} and id = $2`, [param, id]);
      const clash = row
        ? await queryOne(`select 1 from exit_reasons where ${where} and archived_at is null and lower(name) = lower($2) and id <> $3`, [param, row.name, id])
        : null;
      if (clash) throw new Error(`There's already an active reason called "${row!.name}".`);
    }
    await query(`update exit_reasons set archived_at = ${archived ? "now()" : "null"} where ${where} and id = $2`, [param, id]);
    refreshList();
    return null;
  });
}

export async function moveExitReason(id: string, direction: -1 | 1): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const rows = await query<{ id: string }>(`select id from exit_reasons where ${where} and archived_at is null order by position, lower(name)`, [param]);
    const i = rows.findIndex((r) => r.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= rows.length) return null;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [pos, r] of rows.entries()) await query(`update exit_reasons set position = $3 where ${where} and id = $2`, [param, r.id, pos + 1]);
    refreshList();
    return null;
  });
}

// ---- On a person ----

/** Sets people.exited_on to the person's latest open exit (or clears it). */
async function syncExited(userId: string, personId: string) {
  await actorQuery(
    userId,
    `update people set exited_on = (
        select max(exited_on) from person_exits where person_id = $2 and deleted_at is null and reopened_at is null)
      where ${mineOrOrg("$1")} and id = $2 and deleted_at is null`,
    [userId, personId],
  );
}

/** Exits a person (today unless a date is given). Anyone who can see the person can. */
export async function exitPerson(params: { personId: string; reasonId: string; exitedOn?: string | null; note?: string | null }): Promise<ActionResult<{ id: string }>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const person = await getPerson(params.personId);
    if (!person) throw new Error("Person not found.");
    const reason = await findExitReason(params.reasonId);
    if (!reason) throw new Error("That reason isn't on your list anymore.");
    const day = params.exitedOn && DATE_RE.test(params.exitedOn) ? params.exitedOn : null;
    if (day && (day > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) || day < "2000-01-01")) throw new Error("Pick a date that isn't in the future.");
    const note = params.note?.trim().slice(0, 500) || null;
    // One open exit at a time: an earlier open one (if any) is closed by this one.
    await actorQuery(userId, `update person_exits set reopened_at = now() where person_id = $2 and deleted_at is null and reopened_at is null and $1::uuid is not null`, [
      userId,
      person.id,
    ]);
    const row = await actorQueryOne<{ id: string }>(
      userId,
      `insert into person_exits (user_id, person_id, reason_id, kind, exited_on, note)
       values ($1, $2, $3, $4, coalesce($5::date, (now() at time zone coalesce((select timezone from users where id = $1), 'UTC'))::date), $6)
       returning id`,
      [userId, person.id, reason.id, reason.kind, day, note],
    );
    await syncExited(userId, person.id);
    await logActivity({ type: "exit", description: `Exited: ${reason.name}${note ? ` (${note})` : ""}`, personId: person.id });
    revalidatePath(`/people/${person.id}`);
    revalidatePath("/people");
    revalidatePath("/impact");
    revalidatePath("/");
    return { id: row!.id };
  });
}

/** Brings an exited person back (they returned). The exit stays in their history and in reports. */
export async function reopenPerson(personId: string): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const person = await getPerson(personId);
    if (!person) throw new Error("Person not found.");
    await actorQuery(userId, `update person_exits set reopened_at = now() where person_id = $2 and deleted_at is null and reopened_at is null and $1::uuid is not null`, [
      userId,
      person.id,
    ]);
    await syncExited(userId, person.id);
    await logActivity({ type: "exit", description: "Active again", personId: person.id });
    revalidatePath(`/people/${person.id}`);
    revalidatePath("/people");
    revalidatePath("/");
    return null;
  });
}

/** Removes an exit recorded by mistake (by whoever recorded it, or an organization admin). */
export async function removePersonExit(id: string): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const rows = await actorQuery<{ person_id: string }>(
      userId,
      `update person_exits pe set deleted_at = now()
        where pe.id = $2 and pe.deleted_at is null
          and (pe.user_id = $1 or exists (select 1 from memberships m where m.user_id = $1 and m.org_id = pe.org_id and m.active and m.role = 'admin'))
        returning pe.person_id`,
      [userId, id],
    );
    if (!rows.length) throw new Error("Only the person who recorded it, or an admin, can remove it.");
    await syncExited(userId, rows[0].person_id);
    revalidatePath(`/people/${rows[0].person_id}`);
    revalidatePath("/people");
    revalidatePath("/impact");
    return null;
  });
}
