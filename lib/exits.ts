import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { mineOrOrg } from "@/lib/db/scope";
import { getMembership } from "@/lib/org";
import { scopeFilter, serviceScope, type ServiceScope } from "@/lib/services";
import { DEFAULT_EXIT_REASONS, type ExitKind } from "@/lib/exit-kinds";

/**
 * Exits: a client or customer leaves (a program, or as a customer). Same scope as
 * services and outcomes: an organization shares one list of exit reasons its admins
 * manage; a solo account has its own. The person and their history stay; the exit
 * is dated and kept (person_exits), and the Impact/Insights report counts exits by
 * reason and by group (positive, neutral, unplanned).
 */
export type ExitReason = { id: string; name: string; kind: ExitKind; archived: boolean };
export type PersonExit = {
  id: string;
  reasonId: string;
  name: string;
  kind: ExitKind;
  exitedOn: string;
  note: string | null;
  reopenedAt: string | null;
  recordedBy: string | null;
  recordedById: string;
};

export const exitScope = serviceScope;
export type ExitScope = ServiceScope;

type Row = { id: string; name: string; kind: ExitKind; archived_at: string | null };

async function seedIfEmpty(scope: ExitScope): Promise<void> {
  const { where, param } = scopeFilter(scope);
  if (await queryOne(`select 1 from exit_reasons where ${where} limit 1`, [param])) return;
  const m = scope.orgId ? await getMembership() : null;
  const list = scope.orgId ? DEFAULT_EXIT_REASONS[m?.orgKind === "business" ? "business" : "nonprofit"] : DEFAULT_EXIT_REASONS.individual;
  for (const [i, [name, kind]] of list.entries()) {
    await query(`insert into exit_reasons (org_id, user_id, name, kind, position) values ($1, $2, $3, $4, $5) on conflict do nothing`, [
      scope.orgId,
      scope.orgId ? null : scope.userId,
      name,
      kind,
      i + 1,
    ]);
  }
}

export async function listExitReasons(opts: { includeArchived?: boolean } = {}): Promise<ExitReason[]> {
  const scope = await exitScope();
  await seedIfEmpty(scope);
  const { where, param } = scopeFilter(scope);
  const rows = await query<Row>(
    `select id, name, kind, archived_at from exit_reasons
      where ${where} ${opts.includeArchived ? "" : "and archived_at is null"}
      order by archived_at nulls first, position, lower(name)`,
    [param],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, archived: r.archived_at !== null }));
}

/** An active exit reason in the signed-in person's list, or null. */
export async function findExitReason(id: string): Promise<ExitReason | null> {
  const scope = await exitScope();
  const { where, param } = scopeFilter(scope);
  const r = await queryOne<Row>(`select id, name, kind, archived_at from exit_reasons where ${where} and id = $2 and archived_at is null`, [param, id]);
  return r ? { id: r.id, name: r.name, kind: r.kind, archived: false } : null;
}

/** Every exit recorded for a person the signed-in user can see, newest first. */
export async function listPersonExits(personId: string): Promise<PersonExit[]> {
  const userId = await requireUserId();
  const rows = await query<{
    id: string;
    reason_id: string;
    name: string;
    kind: ExitKind;
    exited_on: string;
    note: string | null;
    reopened_at: string | null;
    recorded_by: string | null;
    user_id: string;
  }>(
    `select pe.id, pe.user_id, pe.reason_id, r.name, pe.kind, to_char(pe.exited_on, 'YYYY-MM-DD') as exited_on, pe.note, pe.reopened_at,
            coalesce(u.name, u.email) as recorded_by
       from person_exits pe
       join exit_reasons r on r.id = pe.reason_id
       join people p on p.id = pe.person_id
       left join users u on u.id = pe.user_id
      where pe.person_id = $2 and pe.deleted_at is null and p.deleted_at is null and ${mineOrOrg("$1", "p.")}
      order by pe.exited_on desc, pe.created_at desc`,
    [userId, personId],
  );
  return rows.map((r) => ({
    id: r.id,
    reasonId: r.reason_id,
    name: r.name,
    kind: r.kind,
    exitedOn: r.exited_on,
    note: r.note,
    reopenedAt: r.reopened_at,
    recordedBy: r.recorded_by,
    recordedById: r.user_id,
  }));
}
