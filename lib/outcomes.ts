import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { mineOrOrg } from "@/lib/db/scope";
import { getMembership } from "@/lib/org";
import { scopeFilter, serviceScope, type ServiceScope } from "@/lib/services";

/**
 * Outcomes: results a client or customer reached ("Got a job", "Became a
 * regular"). Same scope as services: an organization shares one list its
 * admins manage; a solo account has its own. The first time a list is opened
 * it's filled with suggestions for the account type, which can be renamed or
 * retired. Recording one on a person dates it (person_outcomes), and the
 * Impact/Insights report counts them per period.
 */
export type Outcome = { id: string; name: string; archived: boolean };
export type PersonOutcome = { id: string; outcomeId: string; name: string; achievedOn: string; note: string | null; recordedBy: string | null; recordedById: string };

export const DEFAULT_OUTCOMES = {
  nonprofit: ["Got a job", "Found housing", "Completed program", "Enrolled in benefits", "Reunited with family"],
  business: ["Became a regular", "Joined membership", "Referred a friend", "Won back"],
  individual: ["Goal reached", "Deal closed"],
} as const;

export const outcomeScope = serviceScope;
export type OutcomeScope = ServiceScope;

type Row = { id: string; name: string; archived_at: string | null };

/** Fills an empty list (never used before) with suggestions for the account type. */
async function seedIfEmpty(scope: OutcomeScope): Promise<void> {
  const { where, param } = scopeFilter(scope);
  if (await queryOne(`select 1 from outcomes where ${where} limit 1`, [param])) return;
  const m = scope.orgId ? await getMembership() : null;
  const names = scope.orgId ? DEFAULT_OUTCOMES[m?.orgKind === "business" ? "business" : "nonprofit"] : DEFAULT_OUTCOMES.individual;
  for (const [i, name] of names.entries()) {
    await query(
      `insert into outcomes (org_id, user_id, name, position) values ($1, $2, $3, $4) on conflict do nothing`,
      [scope.orgId, scope.orgId ? null : scope.userId, name, i + 1],
    );
  }
}

export async function listOutcomes(opts: { includeArchived?: boolean } = {}): Promise<Outcome[]> {
  const scope = await outcomeScope();
  await seedIfEmpty(scope);
  const { where, param } = scopeFilter(scope);
  const rows = await query<Row>(
    `select id, name, archived_at from outcomes
      where ${where} ${opts.includeArchived ? "" : "and archived_at is null"}
      order by archived_at nulls first, position, lower(name)`,
    [param],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, archived: r.archived_at !== null }));
}

/** An active outcome in the signed-in person's list, or null. */
export async function findOutcome(id: string): Promise<Outcome | null> {
  const scope = await outcomeScope();
  const { where, param } = scopeFilter(scope);
  const r = await queryOne<Row>(`select id, name, archived_at from outcomes where ${where} and id = $2 and archived_at is null`, [param, id]);
  return r ? { id: r.id, name: r.name, archived: false } : null;
}

/** Outcomes recorded for a person the signed-in user can see, newest first. */
export async function listPersonOutcomes(personId: string): Promise<PersonOutcome[]> {
  const userId = await requireUserId();
  const rows = await query<{ id: string; outcome_id: string; name: string; achieved_on: string; note: string | null; recorded_by: string | null; user_id: string }>(
    `select po.id, po.user_id, po.outcome_id, o.name, to_char(po.achieved_on, 'YYYY-MM-DD') as achieved_on, po.note,
            coalesce(u.name, u.email) as recorded_by
       from person_outcomes po
       join outcomes o on o.id = po.outcome_id
       join people p on p.id = po.person_id
       left join users u on u.id = po.user_id
      where po.person_id = $2 and po.deleted_at is null and p.deleted_at is null and ${mineOrOrg("$1", "p.")}
      order by po.achieved_on desc, po.created_at desc`,
    [userId, personId],
  );
  return rows.map((r) => ({ id: r.id, outcomeId: r.outcome_id, name: r.name, achievedOn: r.achieved_on, note: r.note, recordedBy: r.recorded_by, recordedById: r.user_id }));
}
