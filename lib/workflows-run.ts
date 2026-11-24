import { query, queryOne } from "@/lib/db/client";
import { actorQueryOne } from "@/lib/db/scope";
import { cleanFieldValue, type FieldKind } from "@/lib/custom-fields-shared";
import {
  WORKFLOW_LIMITS,
  isTimeTrigger,
  matches,
  taskTitle,
  type Action,
  type Condition,
  type EvalContext,
  type Trigger,
} from "@/lib/workflows-shared";

/**
 * Runs automations (no signed-in user: called by the 5-minute cron). Every action is
 * re-checked against the automation's own account at run time, so a rule can never
 * reach another organization, a former member, or a list that isn't its creator's.
 */

export type WorkflowRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  enabled_at: string | null;
};

type Person = {
  id: string;
  user_id: string;
  org_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  custom_fields: Record<string, string> | null;
  exited_on: string | null;
};

export type RunInput = {
  wf: WorkflowRow;
  ref: string;
  person: Person | null;
  ctx: EvalContext;
  submissionId?: string | null;
};

type Notify = (userId: string, n: { type: string; title: string; body: string; href: string; channels?: ("push" | "sms")[] }) => Promise<void>;
const defaultNotify: Notify = async (userId, n) => (await import("@/lib/notify")).notify(userId, n);

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export async function loadPeople(ids: string[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await query<Person>(
    `select id, user_id, org_id, display_name, email, phone, custom_fields, exited_on from people where id = any($1::uuid[]) and deleted_at is null and not is_sample`,
    [unique],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/** Lists (by the automation creator) each person is on. */
export async function listMemberships(creatorId: string, personIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!personIds.length) return out;
  const rows = await query<{ person_id: string; list_id: string }>(
    `select distinct i.person_id, i.list_id from list_items i join lists l on l.id = i.list_id
      where l.user_id = $1 and l.deleted_at is null and i.person_id = any($2::uuid[])`,
    [creatorId, personIds],
  );
  for (const r of rows) out.set(r.person_id, [...(out.get(r.person_id) ?? []), r.list_id]);
  return out;
}

export function personCtx(p: Person | null, lists: string[]): EvalContext["person"] {
  return p
    ? { email: p.email, phone: p.phone, ownerId: p.user_id, custom: (p.custom_fields ?? {}) as Record<string, string>, listIds: lists }
    : { email: null, phone: null, ownerId: "", custom: {}, listIds: [] };
}

/** A person belongs to the automation's account (organization, or the solo owner). */
export function inScope(wf: Pick<WorkflowRow, "org_id" | "user_id">, p: Pick<Person, "org_id" | "user_id">): boolean {
  return wf.org_id ? p.org_id === wf.org_id : p.org_id === null && p.user_id === wf.user_id;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

async function activeMember(orgId: string | null, userId: string, soloOwner: string): Promise<string | null> {
  if (!orgId) return userId === soloOwner ? userId : null;
  const m = await queryOne(`select 1 from memberships where org_id = $1 and user_id = $2 and active`, [orgId, userId]);
  return m ? userId : null;
}

async function managers(orgId: string): Promise<string[]> {
  const rows = await query<{ user_id: string }>(`select user_id from memberships where org_id = $1 and active and role in ('admin', 'supervisor')`, [orgId]);
  return rows.map((r) => r.user_id);
}

/** Due date: today in the assignee's time zone plus N days, at local midnight (how all-day tasks are stored). */
const DUE = `(date_trunc('day', now() at time zone coalesce((select timezone from users where id = $1), 'UTC')) + make_interval(days => $5::int))
             at time zone coalesce((select timezone from users where id = $1), 'UTC')`;

async function runAction(a: Action, input: RunInput, notify: Notify): Promise<string> {
  const { wf, person } = input;
  const creator = (await activeMember(wf.org_id, wf.user_id, wf.user_id)) ?? person?.user_id ?? null;
  const needPerson = () => {
    if (!person) throw new Skip("no profile yet");
    return person;
  };
  switch (a.type) {
    case "create_task": {
      const to =
        a.assignee === "owner"
          ? (person?.user_id ?? creator)
          : a.assignee === "creator"
            ? creator
            : await activeMember(wf.org_id, a.assignee, wf.user_id);
      if (!to) throw new Skip("assignee no longer active");
      const title = taskTitle(a.title, person?.display_name ?? "a new response");
      await actorQueryOne(wf.user_id, `insert into tasks (user_id, title, person_id, notes, due_at) values ($1, $2, $3, $4, ${DUE}) returning id`, [
        to,
        title,
        person?.id ?? null,
        `Added by the automation "${wf.name}".`,
        a.dueDays,
      ]);
      return "task created";
    }
    case "notify": {
      const to =
        a.to === "owner"
          ? [person?.user_id ?? creator]
          : a.to === "managers"
            ? wf.org_id
              ? await managers(wf.org_id)
              : [wf.user_id]
            : [await activeMember(wf.org_id, a.to, wf.user_id)];
      const href = person ? `/people/${person.id}` : input.submissionId ? `/forms/submissions/${input.submissionId}` : "/automations";
      let sent = 0;
      for (const u of to) {
        if (!u) continue;
        // Only the automation's name and its fixed message: never anything about the person.
        await notify(u, { type: "automation", title: wf.name.slice(0, 80), body: a.message, href, channels: ["push"] });
        sent++;
      }
      if (!sent) throw new Skip("nobody to alert");
      return `alert sent to ${sent}`;
    }
    case "flag_followup": {
      const p = needPerson();
      await actorQueryOne(wf.user_id, `update people set needs_followup = true, updated_at = now() where id = $1 and not needs_followup returning id`, [p.id]);
      return "flagged for follow-up";
    }
    case "add_note": {
      const p = needPerson();
      const author = creator ?? p.user_id;
      const note = await actorQueryOne<{ id: string }>(
        wf.user_id,
        `insert into notes (user_id, content, person_id, category) values ($1, $2, $3, 'automation') returning id`,
        [author, a.text, p.id],
      );
      await query(`insert into activity (user_id, type, description, person_id, note_id) values ($1, 'note_added', $2, $3, $4)`, [
        author,
        `Note (automation "${wf.name}"): ${a.text.split("\n")[0].slice(0, 200)}`,
        p.id,
        note?.id ?? null,
      ]);
      return "note added";
    }
    case "set_field": {
      const p = needPerson();
      const f = await queryOne<{ id: string; label: string; kind: FieldKind; options: string[] | null }>(
        `select id, label, kind, options from custom_fields where id = $1 and archived_at is null
            and ${wf.org_id ? "org_id = $2" : "org_id is null and user_id = $2"}`,
        [a.fieldId, wf.org_id ?? wf.user_id],
      );
      if (!f) throw new Skip("field was retired");
      const value = cleanFieldValue({ kind: f.kind, options: f.options ?? [], label: f.label }, a.value);
      if (value === null) throw new Skip("value no longer fits the field");
      await actorQueryOne(wf.user_id, `update people set custom_fields = custom_fields || jsonb_build_object($2::text, $3::text), updated_at = now() where id = $1 returning id`, [
        p.id,
        f.id,
        value,
      ]);
      return "field set";
    }
    case "add_to_list": {
      const p = needPerson();
      const list = await queryOne<{ id: string; user_id: string }>(`select id, user_id from lists where id = $1 and user_id = $2 and deleted_at is null`, [a.listId, wf.user_id]);
      if (!list) throw new Skip("list was deleted");
      const done = await queryOne<{ id: string }>(
        `insert into list_items (user_id, list_id, person_id, label, position)
         select $1, $2, $3, $4, coalesce((select max(position) + 1 from list_items where list_id = $2), 0)
          where not exists (select 1 from list_items where list_id = $2 and person_id = $3)
         returning id`,
        [list.user_id, list.id, p.id, p.display_name],
      );
      return done ? "added to list" : "already on the list";
    }
    case "assign_person": {
      const p = needPerson();
      if (!wf.org_id) throw new Skip("organizations only");
      const to = await activeMember(wf.org_id, a.userId, wf.user_id);
      if (!to) throw new Skip("member no longer active");
      if (p.user_id === to) return "already assigned";
      await actorQueryOne(wf.user_id, `update people set user_id = $2, updated_at = now() where id = $1 and org_id = $3 returning id`, [p.id, to, wf.org_id]);
      return "person assigned";
    }
    case "assign_response": {
      if (!input.submissionId || !wf.org_id) throw new Skip("no response");
      const to = await activeMember(wf.org_id, a.userId, wf.user_id);
      if (!to) throw new Skip("member no longer active");
      await query(`update form_submissions set assigned_to = $2 where id = $1 and org_id = $3 and deleted_at is null`, [input.submissionId, to, wf.org_id]);
      return "response assigned";
    }
    case "set_response_status": {
      if (!input.submissionId) throw new Skip("no response");
      await query(
        `update form_submissions set status = $2 where id = $1 and deleted_at is null and status in ('new', 'needs_review')
            and ${wf.org_id ? "org_id = $3" : "org_id is null and user_id = $3"}`,
        [input.submissionId, a.status, wf.org_id ?? wf.user_id],
      );
      return "response status changed";
    }
  }
}

class Skip extends Error {}

/* ------------------------------------------------------------------ */
/* One run                                                             */
/* ------------------------------------------------------------------ */

/**
 * Runs one automation once for one event or person. Claims the ref first (so it can
 * never run twice), checks caps and conditions, then does each action. Returns the
 * status written to the run log, or null if it already ran.
 */
export async function runOne(input: RunInput, notify: Notify = defaultNotify): Promise<"done" | "skipped" | "failed" | "capped" | null> {
  const { wf, person } = input;
  const claimed = await queryOne<{ id: string }>(
    `insert into workflow_runs (workflow_id, org_id, user_id, person_id, ref, status) values ($1, $2, $3, $4, $5, 'skipped')
     on conflict (workflow_id, ref) do nothing returning id`,
    [wf.id, wf.org_id, wf.user_id, person?.id ?? null, input.ref],
  );
  if (!claimed) return null;
  const finish = async (status: "done" | "skipped" | "failed" | "capped", detail: string, actions = 0) => {
    await query(`update workflow_runs set status = $2, detail = $3, actions = $4 where id = $1`, [claimed.id, status, detail.slice(0, 500), actions]);
    return status;
  };

  // Caps: per automation per day, and actions across the whole account per day.
  const caps = await queryOne<{ runs: number; actions: number }>(
    `select (select count(*) from workflow_runs where workflow_id = $1 and status = 'done' and created_at > now() - interval '1 day')::int as runs,
            (select coalesce(sum(actions), 0) from workflow_runs
              where ${wf.org_id ? "org_id = $2" : "org_id is null and user_id = $2"} and created_at > now() - interval '1 day')::int as actions`,
    [wf.id, wf.org_id ?? wf.user_id],
  );
  if ((caps?.runs ?? 0) >= WORKFLOW_LIMITS.runsPerDay || (caps?.actions ?? 0) + wf.actions.length > WORKFLOW_LIMITS.actionsPerDay) {
    return finish("capped", "Daily limit reached");
  }

  if (person && !inScope(wf, person)) return finish("skipped", "Not in this account");
  if (person?.exited_on && wf.trigger.type !== "person_exited") return finish("skipped", "Person has exited");
  if (!matches(wf.conditions, input.ctx)) return finish("skipped", "Conditions not met");

  const done: string[] = [];
  let count = 0;
  for (const a of wf.actions) {
    try {
      done.push(await runAction(a, input, notify));
      count++;
    } catch (err) {
      if (err instanceof Skip) done.push(`skipped: ${err.message}`);
      else {
        console.error("[automations] action failed", wf.id, a.type, err instanceof Error ? err.message : err);
        done.push(`${a.type} failed`);
        await finish("failed", done.join(" · "), count);
        return "failed";
      }
    }
  }
  if (wf.org_id && person) {
    // The audit log records that an automation acted on this client (action names only).
    await query(`insert into audit_log (org_id, actor_id, action, table_name, record_id, person_id, fields) values ($1, $2, 'automation', 'workflows', $3, $4, $5)`, [
      wf.org_id,
      wf.user_id,
      wf.id,
      person.id,
      wf.actions.map((a) => a.type),
    ]);
  }
  return finish(count ? "done" : "skipped", done.join(" · "), count);
}

/* ------------------------------------------------------------------ */
/* The job                                                             */
/* ------------------------------------------------------------------ */

const WF_COLS = `w.id, w.user_id, w.org_id, w.name, w.trigger, w.conditions, w.actions, w.enabled_at`;

/** Event context for one event of a kind (submission answers, exit, visit). */
async function eventDetails(kind: string, refId: string) {
  if (kind === "form_submitted") {
    return queryOne<{ form_id: string; answers: Record<string, string>; person_id: string | null; deleted_at: string | null }>(
      `select form_id, answers, person_id, deleted_at from form_submissions where id = $1`,
      [refId],
    );
  }
  if (kind === "person_exited") return queryOne<{ kind: string; reason_id: string; person_id: string }>(`select kind, reason_id, person_id from person_exits where id = $1`, [refId]);
  if (kind === "check_in") return queryOne<{ service_id: string | null; person_id: string }>(`select service_id, person_id from check_ins where id = $1 and deleted_at is null`, [refId]);
  return {};
}

/** Event triggers: everything queued since the last run. */
async function runEvents(notify: Notify): Promise<number> {
  const events = await query<{ id: string; kind: string; user_id: string; org_id: string | null; person_id: string | null; ref_id: string; created_at: string }>(
    `update automation_events set processed_at = now()
      where id in (select id from automation_events where processed_at is null order by created_at limit 300 for update skip locked)
      returning id, kind, user_id, org_id, person_id, ref_id, created_at`,
  );
  let runs = 0;
  for (const ev of events) {
    try {
      const wfs = await query<WorkflowRow>(
        `select ${WF_COLS} from workflows w
          where w.enabled and w.deleted_at is null and w.org_id is not null and w.trigger->>'type' = $1 and w.enabled_at <= $4
            and (($2::uuid is not null and w.org_id = $2) or ($2::uuid is null and w.org_id is null and w.user_id = $3))`,
        [ev.kind, ev.org_id, ev.user_id, ev.created_at],
      );
      if (!wfs.length) continue;
      const d = (await eventDetails(ev.kind, ev.ref_id)) as Record<string, unknown> | null;
      if (!d) continue; // the visit or exit was removed before the job ran
      const personId = (d.person_id as string | null | undefined) ?? ev.person_id;
      const person = personId ? ((await loadPeople([personId])).get(personId) ?? null) : null;
      for (const wf of wfs) {
        if (ev.kind === "form_submitted" && (wf.trigger as { formId?: string }).formId !== d.form_id) continue;
        if (ev.kind === "form_submitted" && d.deleted_at) continue;
        const lists = person ? ((await listMemberships(wf.user_id, [person.id])).get(person.id) ?? []) : [];
        const ctx: EvalContext = {
          person: personCtx(person, lists),
          answers: ev.kind === "form_submitted" ? (d.answers as Record<string, string>) : undefined,
          exit: ev.kind === "person_exited" ? { kind: d.kind as string, reasonId: d.reason_id as string } : undefined,
          serviceId: ev.kind === "check_in" ? ((d.service_id as string | null) ?? null) : undefined,
        };
        const r = await runOne({ wf, ref: `e:${ev.id}`, person, ctx, submissionId: ev.kind === "form_submitted" ? ev.ref_id : null }, notify);
        if (r) runs++;
      }
    } catch (err) {
      console.error("[automations] event failed", ev.kind, err instanceof Error ? err.message : err);
    }
  }
  return runs;
}

/** SQL that picks people for a time trigger, with the ref that makes it happen once. `$1` = scope, `$2` = days (or field), `$3` = tz owner. */
export function timeCandidates(t: Trigger): { where: string; ref: string; params: unknown[] } | null {
  const today = `(now() at time zone coalesce((select timezone from users where id = $3), 'UTC'))::date`;
  if (t.type === "no_contact") {
    return { where: `p.last_activity_at < now() - make_interval(days => $2::int)`, ref: `p.id || ':' || to_char(p.last_activity_at, 'YYYY-MM-DD')`, params: [t.days] };
  }
  if (t.type === "birthday") {
    return {
      where: `p.birthday is not null and to_char(p.birthday, 'MM-DD') = to_char(${today} + $2::int, 'MM-DD')`,
      ref: `p.id || ':' || to_char(${today} + $2::int, 'YYYY')`,
      params: [t.days],
    };
  }
  if (t.type === "date_field") {
    return {
      where: `(p.custom_fields->>$4) ~ '^\\d{4}-\\d{2}-\\d{2}$' and (p.custom_fields->>$4)::date + $2::int = ${today}`,
      ref: `p.id || ':' || (p.custom_fields->>$4)`,
      params: [t.days, t.fieldId],
    };
  }
  return null;
}

/** Time triggers: people who reached the moment, not run yet. */
async function runTime(notify: Notify): Promise<number> {
  const wfs = await query<WorkflowRow>(
    `select ${WF_COLS} from workflows w join users u on u.id = w.user_id and u.suspended_at is null
      where w.enabled and w.deleted_at is null and w.org_id is not null and w.trigger->>'type' in ('no_contact', 'birthday', 'date_field')`,
  );
  let runs = 0;
  for (const wf of wfs) {
    try {
      const c = timeCandidates(wf.trigger);
      if (!c) continue;
      const [days, field] = c.params;
      const rows = await query<{ id: string; ref: string }>(
        `select p.id, ${c.ref} as ref from people p
          where p.deleted_at is null and not p.is_sample and p.exited_on is null
            and ${wf.org_id ? "p.org_id = $1" : "p.org_id is null and p.user_id = $1"}
            and ${c.where}
            and not exists (select 1 from workflow_runs r where r.workflow_id = $5 and r.ref = ${c.ref})
            and $3::uuid is not null and ($4::text is null or true)
          order by p.last_activity_at limit 100`,
        [wf.org_id ?? wf.user_id, days, wf.user_id, field ?? null, wf.id],
      );
      if (!rows.length) continue;
      const people = await loadPeople(rows.map((r) => r.id));
      const lists = await listMemberships(wf.user_id, rows.map((r) => r.id));
      for (const r of rows) {
        const person = people.get(r.id) ?? null;
        if (!person) continue;
        const res = await runOne({ wf, ref: r.ref, person, ctx: { person: personCtx(person, lists.get(r.id) ?? []) } }, notify);
        if (res === "capped") break;
        if (res) runs++;
      }
    } catch (err) {
      console.error("[automations] time rule failed", wf.id, err instanceof Error ? err.message : err);
    }
  }
  return runs;
}

/** The 5-minute job. Never throws. Returns how many runs happened. */
export async function runWorkflows(notify: Notify = defaultNotify): Promise<number> {
  let runs = 0;
  try {
    runs += await runEvents(notify);
  } catch (err) {
    console.error("[automations] events failed", err instanceof Error ? err.message : err);
  }
  try {
    runs += await runTime(notify);
  } catch (err) {
    console.error("[automations] time rules failed", err instanceof Error ? err.message : err);
  }
  // Housekeeping: processed events older than a week, run logs older than a year.
  await query(`delete from automation_events where processed_at < now() - interval '7 days'`).catch(() => {});
  await query(`delete from workflow_runs where created_at < now() - interval '365 days'`).catch(() => {});
  return runs;
}

export { isTimeTrigger };
