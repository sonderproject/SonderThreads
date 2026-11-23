import { query, queryOne } from "@/lib/db/client";
import { formScope, type FormScope } from "@/lib/forms";
import { formFilter } from "@/lib/forms-scope";
import { listCustomFields } from "@/lib/custom-fields";
import { listMemberships, loadPeople, personCtx, timeCandidates } from "@/lib/workflows-run";
import { isTimeTrigger, matches, type Action, type Condition, type EvalContext, type Trigger, type Workflow, type WorkflowContext } from "@/lib/workflows-shared";
import { displayName, profileFromAnswers, type FormField } from "@/lib/forms-shared";

/**
 * Automations for signed-in people. Same access as forms: an organization shares its
 * automations (Admins and Managers build them, everyone can see them); a solo account
 * has its own.
 */
export const workflowScope = formScope;
export type { FormScope as WorkflowScope };

export type Named = { id: string; name: string };
export type BuilderData = {
  ctx: WorkflowContext;
  names: {
    members: Named[];
    lists: Named[];
    services: Named[];
    exitReasons: Named[];
    customFields: { id: string; label: string; kind: string; options: string[] }[];
    forms: { id: string; name: string; fields: { id: string; label: string; type: string; options?: string[] }[] }[];
  };
};

/** Everything the builder can pick from, all from the signed-in person's own account. */
export async function builderData(s: FormScope): Promise<BuilderData> {
  const { where, param } = formFilter(s);
  const [members, lists, services, exitReasons, customFields, forms] = await Promise.all([
    s.orgId
      ? query<{ id: string; name: string | null; email: string }>(
          `select u.id, u.name, u.email from memberships m join users u on u.id = m.user_id where m.org_id = $1 and m.active order by lower(coalesce(u.name, u.email))`,
          [s.orgId],
        )
      : Promise.resolve([]),
    query<Named>(`select id, name from lists where user_id = $1 and deleted_at is null order by lower(name)`, [s.userId]),
    query<Named>(`select id, name from services where ${where} and archived_at is null order by lower(name)`, [param]),
    query<Named>(`select id, name from exit_reasons where ${where} and archived_at is null order by position, lower(name)`, [param]),
    listCustomFields(),
    query<{ id: string; name: string; fields: FormField[] }>(`select id, name, fields from forms where ${where} and deleted_at is null and status <> 'archived' order by lower(name)`, [param]),
  ]);
  const fieldsOf = (fs: FormField[]) => fs.map((f) => ({ id: f.id, label: f.label, type: f.type, options: f.options }));
  return {
    ctx: {
      isOrg: Boolean(s.orgId),
      members: members.map((m) => m.id),
      lists: lists.map((l) => l.id),
      services: services.map((x) => x.id),
      exitReasons: exitReasons.map((x) => x.id),
      customFields: customFields.map((c) => ({ id: c.id, label: c.label, kind: c.kind, options: c.options })),
      forms: forms.map((f) => ({ id: f.id, fields: fieldsOf(f.fields) })),
    },
    names: {
      members: members.map((m) => ({ id: m.id, name: m.name?.trim() || m.email })),
      lists,
      services,
      exitReasons,
      customFields: customFields.map((c) => ({ id: c.id, label: c.label, kind: c.kind, options: c.options })),
      forms: forms.map((f) => ({ id: f.id, name: f.name, fields: fieldsOf(f.fields) })),
    },
  };
}

export type WorkflowSummary = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  actions: Action[];
  conditions: Condition[];
  runsWeek: number;
  lastRun: string | null;
  failedWeek: number;
};

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const s = await workflowScope();
  const { where, param } = formFilter(s, "w.");
  const rows = await query<{
    id: string;
    name: string;
    enabled: boolean;
    trigger: Trigger;
    actions: Action[];
    conditions: Condition[];
    runs_week: number;
    failed_week: number;
    last_run: string | null;
  }>(
    `select w.id, w.name, w.enabled, w.trigger, w.actions, w.conditions,
            (select count(*) from workflow_runs r where r.workflow_id = w.id and r.status = 'done' and r.created_at > now() - interval '7 days')::int as runs_week,
            (select count(*) from workflow_runs r where r.workflow_id = w.id and r.status = 'failed' and r.created_at > now() - interval '7 days')::int as failed_week,
            (select max(created_at) from workflow_runs r where r.workflow_id = w.id and r.status = 'done') as last_run
       from workflows w where ${where} and w.deleted_at is null
      order by w.enabled desc, w.updated_at desc`,
    [param],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    trigger: r.trigger,
    actions: r.actions,
    conditions: r.conditions,
    runsWeek: r.runs_week,
    failedWeek: r.failed_week,
    lastRun: r.last_run,
  }));
}

export type WorkflowDetail = { id: string; name: string; enabled: boolean; workflow: Workflow; updatedAt: string; ownerName: string | null };

export async function getWorkflow(id: string): Promise<WorkflowDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const s = await workflowScope();
  const { where, param } = formFilter(s, "w.");
  const r = await queryOne<{ id: string; name: string; enabled: boolean; trigger: Trigger; conditions: Condition[]; actions: Action[]; updated_at: string; owner: string | null }>(
    `select w.id, w.name, w.enabled, w.trigger, w.conditions, w.actions, w.updated_at, u.name as owner
       from workflows w join users u on u.id = w.user_id where ${where} and w.id = $2 and w.deleted_at is null`,
    [param, id],
  );
  if (!r) return null;
  return { id: r.id, name: r.name, enabled: r.enabled, workflow: { trigger: r.trigger, conditions: r.conditions, actions: r.actions }, updatedAt: r.updated_at, ownerName: r.owner };
}

export type RunRow = { id: string; status: string; detail: string | null; personId: string | null; personName: string | null; createdAt: string };

/** The run log (Admins and Managers, or the solo owner). Names only of people in this account. */
export async function workflowRuns(id: string, limit = 50): Promise<RunRow[]> {
  const s = await workflowScope();
  if (!s.canManage) return [];
  const { where, param } = formFilter(s, "w.");
  const rows = await query<{ id: string; status: string; detail: string | null; person_id: string | null; person_name: string | null; created_at: string }>(
    `select r.id, r.status, r.detail, r.person_id, p.display_name as person_name, r.created_at
       from workflow_runs r join workflows w on w.id = r.workflow_id
       left join people p on p.id = r.person_id and p.deleted_at is null and ${s.orgId ? "p.org_id = w.org_id" : "p.user_id = w.user_id"}
      where ${where} and w.id = $2 and r.status <> 'skipped'
      order by r.created_at desc limit $3`,
    [param, id, limit],
  );
  return rows.map((r) => ({ id: r.id, status: r.status, detail: r.detail, personId: r.person_id, personName: r.person_name, createdAt: r.created_at }));
}

export async function skippedCount(id: string): Promise<number> {
  const r = await queryOne<{ n: number }>(`select count(*)::int as n from workflow_runs where workflow_id = $1 and status = 'skipped' and created_at > now() - interval '30 days'`, [id]);
  return r?.n ?? 0;
}

/* ------------------------------------------------------------------ */
/* Test this rule (dry run: reads only, changes nothing)               */
/* ------------------------------------------------------------------ */

export type Preview = { window: "last 30 days" | "right now"; considered: number; matched: number; names: string[] };

export async function previewWorkflow(s: FormScope, wf: Workflow): Promise<Preview> {
  const scope = s.orgId ?? s.userId;
  const personScope = s.orgId ? "p.org_id = $1" : "p.org_id is null and p.user_id = $1";
  const items: { personId: string | null; extra: Partial<EvalContext>; label?: string }[] = [];
  const t = wf.trigger;

  if (t.type === "form_submitted") {
    const rows = await query<{ person_id: string | null; answers: Record<string, string>; fields: FormField[] }>(
      `select person_id, answers, fields from form_submissions where form_id = $2 and deleted_at is null and created_at > now() - interval '30 days'
          and ${s.orgId ? "org_id = $1" : "org_id is null and user_id = $1"} order by created_at desc limit 200`,
      [scope, t.formId],
    );
    for (const r of rows) items.push({ personId: r.person_id, extra: { answers: r.answers }, label: displayName(profileFromAnswers(r.fields ?? [], r.answers ?? {})) || undefined });
  } else if (t.type === "person_added") {
    const rows = await query<{ id: string }>(
      `select p.id from people p where ${personScope} and p.deleted_at is null and not p.is_sample and p.import_batch is null and p.created_at > now() - interval '30 days' limit 200`,
      [scope],
    );
    for (const r of rows) items.push({ personId: r.id, extra: {} });
  } else if (t.type === "person_exited") {
    const rows = await query<{ person_id: string; kind: string; reason_id: string }>(
      `select e.person_id, e.kind, e.reason_id from person_exits e join people p on p.id = e.person_id
        where ${personScope} and e.deleted_at is null and e.created_at > now() - interval '30 days' limit 200`,
      [scope],
    );
    for (const r of rows) items.push({ personId: r.person_id, extra: { exit: { kind: r.kind, reasonId: r.reason_id } } });
  } else if (t.type === "check_in") {
    const rows = await query<{ person_id: string; service_id: string | null }>(
      `select c.person_id, c.service_id from check_ins c join people p on p.id = c.person_id
        where ${personScope} and c.deleted_at is null and c.checked_in_at > now() - interval '30 days' limit 200`,
      [scope],
    );
    for (const r of rows) items.push({ personId: r.person_id, extra: { serviceId: r.service_id } });
  } else {
    const c = timeCandidates(t);
    if (c) {
      const [days, field] = c.params;
      const rows = await query<{ id: string }>(
        `select p.id from people p where ${personScope} and p.deleted_at is null and not p.is_sample and p.exited_on is null and ${c.where}
            and $3::uuid is not null and ($4::text is null or true) limit 200`,
        [scope, days, s.userId, field ?? null],
      );
      for (const r of rows) items.push({ personId: r.id, extra: {} });
    }
  }

  const ids = items.map((i) => i.personId).filter(Boolean) as string[];
  const people = await loadPeople(ids);
  const lists = await listMemberships(s.userId, ids);
  let matched = 0;
  const names: string[] = [];
  for (const it of items) {
    const p = it.personId ? (people.get(it.personId) ?? null) : null;
    if (p?.exited_on && t.type !== "person_exited") continue;
    if (matches(wf.conditions, { person: personCtx(p, p ? (lists.get(p.id) ?? []) : []), ...it.extra })) {
      matched++;
      if (names.length < 8) names.push(p?.display_name ?? it.label ?? "An unnamed response");
    }
  }
  return { window: isTimeTrigger(t.type) ? "right now" : "last 30 days", considered: items.length, matched, names };
}
