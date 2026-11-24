import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { query, transaction } from "@/lib/db/client";
import { ETHNICITIES, GENDERS, INCOME_LEVELS } from "@/lib/demographics";
import { cleanDefinition, cleanSettings, type FormField } from "@/lib/forms-shared";
import { cleanSchedule } from "@/lib/dashboard-shared";

/**
 * Core of Settings → Data → Import backup: restores a full backup file (the JSON
 * from /api/export) into the signed-in account, all or nothing.
 *
 * Every record keeps its links (a note stays on its person, an entry on its
 * list). Ids: a record whose id is free (or already this account's) keeps
 * it; one whose id belongs to another account (restoring someone's backup
 * into a second account) gets a new id derived from (this account, old id),
 * so the same file always maps to the same ids. Anything already in this
 * account is skipped, so importing the same file twice adds nothing.
 */

const id = z.string().uuid();
const optId = id.nullable().optional();
const text = (max: number) => z.string().max(max).nullable().optional();
const date = z.union([z.string(), z.number()]).nullable().optional();

const backupSchema = z.object({
  exported_at: z.string().optional(),
  people: z
    .array(
      z.object({
        id,
        first_name: z.string().min(1).max(200),
        last_name: text(200),
        display_name: z.string().min(1).max(400),
        phone: text(50),
        email: text(320),
        birthday: date,
        client_since: date,
        gender: text(100),
        ethnicity: text(100),
        income_level: text(100),
        status: text(100),
        current_status: text(5000),
        next_action: text(5000),
        summary: text(20000),
        needs_followup: z.boolean().optional(),
        custom_fields: z.record(z.string(), z.unknown()).nullable().optional(),
        created_at: date,
        updated_at: date,
        last_activity_at: date,
      }),
    )
    .default([]),
  notes: z
    .array(z.object({ id, person_id: optId, content: z.string().max(100000), category: text(100), created_at: date, updated_at: date }))
    .default([]),
  lists: z
    .array(z.object({ id, name: z.string().min(1).max(200), description: text(5000), is_group: z.boolean().optional(), created_at: date, updated_at: date }))
    .default([]),
  list_items: z
    .array(
      z.object({
        id,
        list_id: id,
        person_id: optId,
        label: z.string().max(1000),
        note: text(5000),
        checked: z.boolean().optional(),
        position: z.number().int().optional(),
        created_at: date,
        updated_at: date,
      }),
    )
    .default([]),
  tasks: z
    .array(
      z.object({
        id,
        title: z.string().min(1).max(2000),
        notes: text(20000),
        person_id: optId,
        list_id: optId,
        due_at: date,
        recurrence: text(20),
        completed: z.boolean().optional(),
        completed_at: date,
        created_at: date,
        updated_at: date,
      }),
    )
    .default([]),
  check_ins: z
    .array(
      z.object({
        id,
        person_id: id,
        checked_in_at: date,
        reason: text(5000),
        amount_cents: z.number().int().min(0).max(100000000).nullable().optional(),
        created_at: date,
        updated_at: date,
      }),
    )
    .default([]),
  activity: z
    .array(
      z.object({
        id,
        person_id: optId,
        list_id: optId,
        task_id: optId,
        note_id: optId,
        type: z.string().max(100),
        description: z.string().max(5000),
        created_at: date,
      }),
    )
    .default([]),
  // Added Nov 2026; older backup files simply don't have these.
  custom_fields: z.array(z.object({ id, label: z.string().max(60) })).default([]),
  exits: z
    .array(
      z.object({
        id,
        person_id: id,
        reason: z.string().min(1).max(80),
        group: z.enum(["positive", "neutral", "unplanned"]),
        exited_on: date,
        note: text(500),
        came_back_at: date,
        created_at: date,
      }),
    )
    .default([]),
  outcomes: z
    .array(z.object({ id, person_id: id, outcome: z.string().min(1).max(80), achieved_on: date, note: text(500), created_at: date }))
    .default([]),
  forms: z
    .array(
      z.object({ id, name: z.string().min(1).max(120), description: text(1000), fields: z.array(z.unknown()).max(60), settings: z.unknown().optional(), created_at: date }),
    )
    .max(50)
    .default([]),
  form_responses: z
    .array(
      z.object({
        id,
        form_id: id,
        answers: z.record(z.string(), z.unknown()),
        fields: z.array(z.unknown()).max(60),
        status: text(20),
        person_id: optId,
        created_at: date,
      }),
    )
    .max(20000)
    .default([]),
  automations: z
    .array(z.object({ id, name: z.string().min(1).max(80), trigger: z.record(z.string(), z.unknown()), conditions: z.array(z.unknown()).max(10), actions: z.array(z.unknown()).max(5) }))
    .max(25)
    .default([]),
  report_schedules: z.array(z.record(z.string(), z.unknown()).and(z.object({ id }))).max(10).default([]),
});

export type Backup = z.infer<typeof backupSchema>;
export type RestoreCounts = {
  people: number;
  notes: number;
  tasks: number;
  check_ins: number;
  lists: number;
  list_items: number;
  activity: number;
  exits: number;
  outcomes: number;
  forms: number;
  form_responses: number;
  automations: number;
  report_schedules: number;
};

const TABLES = ["people", "notes", "lists", "list_items", "tasks", "check_ins", "activity"] as const;
type Table = (typeof TABLES)[number];

/** A stable new id for an old id in this account (UUID-shaped md5). */
function derivedId(userId: string, oldId: string): string {
  const h = createHash("md5").update(`${userId}:${oldId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function ts(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function day(value: string | number | null | undefined): string | null {
  const iso = ts(value);
  return iso ? iso.slice(0, 10) : null;
}

export function parseBackup(raw: unknown): Backup {
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    throw new Error("This doesn't look like a Surfdesk backup file. Use the file from Settings → Data → backup (JSON).");
  }
  if (TABLES.every((t) => result.data[t].length === 0)) throw new Error("This backup file is empty.");
  return result.data;
}

export function countsOf(b: Backup): RestoreCounts {
  return {
    people: b.people.length,
    notes: b.notes.length,
    tasks: b.tasks.length,
    check_ins: b.check_ins.length,
    lists: b.lists.length,
    list_items: b.list_items.length,
    activity: b.activity.length,
    exits: b.exits.length,
    outcomes: b.outcomes.length,
    forms: b.forms.length,
    form_responses: b.form_responses.length,
    automations: b.automations.length,
    report_schedules: b.report_schedules.length,
  };
}

/** Where ids land in this account: kept if free or already ours, else a stable new one. Returns old → new, and which are already ours. */
async function mapIds(table: string, userId: string, ids: string[]): Promise<{ map: Map<string, string>; ours: Set<string> }> {
  const rows = ids.length ? await query<{ id: string; user_id: string }>(`select id, user_id from ${table} where id = any($1::uuid[])`, [ids]) : [];
  const owner = new Map(rows.map((r) => [r.id, r.user_id]));
  const map = new Map<string, string>();
  const ours = new Set<string>();
  for (const old of ids) {
    const o = owner.get(old);
    if (o === userId) ours.add(old);
    map.set(old, !o || o === userId ? old : derivedId(userId, old));
  }
  return { map, ours };
}

/**
 * Restores a parsed backup into the given account and returns how many
 * records were added (skipping ones already there). Not a server action:
 * callers must pass the id from requireUserId() (lib/actions/restore.ts).
 */
export async function restoreInto(userId: string, b: Backup): Promise<RestoreCounts> {
  {

    // Which of the file's ids exist already, and whose they are.
    const owners = new Map<Table, Map<string, string>>();
    for (const t of TABLES) {
      const ids = b[t].map((r) => r.id);
      const rows = ids.length
        ? await query<{ id: string; user_id: string }>(`select id, user_id from ${t} where id = any($1::uuid[])`, [ids])
        : [];
      owners.set(t, new Map(rows.map((r) => [r.id, r.user_id])));
    }
    const map = new Map<Table, Map<string, string>>();
    for (const t of TABLES) {
      const m = new Map<string, string>();
      for (const r of b[t]) {
        const owner = owners.get(t)!.get(r.id);
        m.set(r.id, !owner || owner === userId ? r.id : derivedId(userId, r.id));
      }
      map.set(t, m);
    }

    // Lists are unique by name per account: restoring "Groceries" into an
    // account that already has one adds the entries to the existing list.
    const existingLists = await query<{ id: string; name: string }>(
      `select id, name from lists where user_id = $1 and deleted_at is null`,
      [userId],
    );
    const byName = new Map(existingLists.map((l) => [l.name.toLowerCase(), l.id]));
    for (const l of b.lists) {
      const existing = byName.get(l.name.toLowerCase());
      if (existing) map.get("lists")!.set(l.id, existing);
    }

    /** New id for a reference: from the file, or an id already in this account, else null. */
    const ownIds = new Map<Table, Set<string>>();
    for (const t of ["people", "lists", "tasks", "notes"] as const) {
      const rows = await query<{ id: string }>(`select id from ${t} where user_id = $1`, [userId]);
      ownIds.set(t, new Set(rows.map((r) => r.id)));
    }
    const ref = (t: "people" | "lists" | "tasks" | "notes", oldId: string | null | undefined): string | null => {
      if (!oldId) return null;
      const mapped = map.get(t)!.get(oldId);
      if (mapped) return mapped;
      return ownIds.get(t)!.has(oldId) ? oldId : null;
    };

    const added: RestoreCounts = {
      people: 0,
      notes: 0,
      tasks: 0,
      check_ins: 0,
      lists: 0,
      list_items: 0,
      activity: 0,
      exits: 0,
      outcomes: 0,
      forms: 0,
      form_responses: 0,
      automations: 0,
      report_schedules: 0,
    };

    // The account's scope: an organization (Business) or a solo account.
    const membership = await query<{ org_id: string; kind: string }>(
      `select m.org_id, o.kind from memberships m join organizations o on o.id = m.org_id where m.user_id = $1 and m.active`,
      [userId],
    );
    const orgId = membership[0]?.org_id ?? null;
    const scopeSql = orgId ? "org_id = $1" : "org_id is null and user_id = $1";
    const scopeParam = orgId ?? userId;

    // Custom field values: matched to this account's fields by id, else by the field's name in the file.
    const accountFields = await query<{ id: string; label: string; kind: string }>(
      `select id, label, kind from custom_fields where ${scopeSql} and archived_at is null`,
      [scopeParam],
    );
    const fieldById = new Map(accountFields.map((f) => [f.id, f.id]));
    const fieldByLabel = new Map(accountFields.map((f) => [f.label.toLowerCase(), f.id]));
    const fileLabel = new Map(b.custom_fields.map((f) => [f.id, f.label.toLowerCase()]));
    const customFor = (raw: Record<string, unknown> | null | undefined): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw ?? {})) {
        if (v === null || v === undefined || v === "") continue;
        const target = fieldById.get(k) ?? fieldByLabel.get(fileLabel.get(k) ?? "");
        if (target) out[target] = String(v).slice(0, 200);
      }
      return out;
    };
    const now = Date.now();

    const [exitIds, outcomeIds, formIds, responseIds, workflowIds, scheduleIds] = await Promise.all([
      mapIds("person_exits", userId, b.exits.map((r) => r.id)),
      mapIds("person_outcomes", userId, b.outcomes.map((r) => r.id)),
      mapIds("forms", userId, b.forms.map((r) => r.id)),
      mapIds("form_submissions", userId, b.form_responses.map((r) => r.id)),
      mapIds("workflows", userId, b.automations.map((r) => r.id)),
      mapIds("report_schedules", userId, b.report_schedules.map((r) => r.id)),
    ]);

    await transaction(async (q) => {
      const insert = async (sql: string, params: unknown[]) => {
        const res = (await q(sql, params)) as { rowCount: number | null };
        return res.rowCount ?? 0;
      };

      for (const p of b.people) {
        added.people += await insert(
          `insert into people (id, user_id, first_name, last_name, display_name, phone, email, birthday, gender, ethnicity,
             income_level, status, current_status, next_action, summary, needs_followup, created_at, updated_at, last_activity_at, client_since, custom_fields)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,coalesce($17,now()),coalesce($18,now()),coalesce($19,now()),$20,$21)
           on conflict (id) do nothing`,
          [
            map.get("people")!.get(p.id),
            userId,
            p.first_name,
            p.last_name ?? null,
            p.display_name,
            p.phone ?? null,
            p.email ?? null,
            day(p.birthday),
            oneOf(p.gender, GENDERS),
            oneOf(p.ethnicity, ETHNICITIES),
            oneOf(p.income_level, INCOME_LEVELS),
            p.status ?? "active",
            p.current_status ?? null,
            p.next_action ?? null,
            p.summary ?? null,
            p.needs_followup ?? false,
            ts(p.created_at),
            ts(p.updated_at),
            ts(p.last_activity_at),
            day(p.client_since),
            JSON.stringify(customFor(p.custom_fields as Record<string, unknown> | null | undefined)),
          ],
        );
      }

      for (const l of b.lists) {
        const newId = map.get("lists")!.get(l.id)!;
        if (byName.has(l.name.toLowerCase())) continue; // merged into the existing list
        added.lists += await insert(
          `insert into lists (id, user_id, name, description, is_group, created_at, updated_at)
           values ($1,$2,$3,$4,$5,coalesce($6,now()),coalesce($7,now()))
           on conflict do nothing`,
          [newId, userId, l.name, l.description ?? null, l.is_group ?? false, ts(l.created_at), ts(l.updated_at)],
        );
        byName.set(l.name.toLowerCase(), newId);
      }

      for (const n of b.notes) {
        added.notes += await insert(
          `insert into notes (id, user_id, person_id, content, category, created_at, updated_at)
           values ($1,$2,$3,$4,$5,coalesce($6,now()),coalesce($7,now()))
           on conflict (id) do nothing`,
          [map.get("notes")!.get(n.id), userId, ref("people", n.person_id), n.content, n.category ?? null, ts(n.created_at), ts(n.updated_at)],
        );
      }

      for (const t of b.tasks) {
        const due = ts(t.due_at);
        // Past-due tasks count as already reminded, so a restore doesn't send a burst of reminders.
        const reminded = due && new Date(due).getTime() < now ? new Date(now).toISOString() : null;
        added.tasks += await insert(
          `insert into tasks (id, user_id, title, notes, person_id, list_id, due_at, recurrence, completed, completed_at,
             reminded_at, created_at, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12,now()),coalesce($13,now()))
           on conflict (id) do nothing`,
          [
            map.get("tasks")!.get(t.id),
            userId,
            t.title,
            t.notes ?? null,
            ref("people", t.person_id),
            ref("lists", t.list_id),
            due,
            oneOf(t.recurrence, ["daily", "weekly", "monthly"] as const),
            t.completed ?? false,
            ts(t.completed_at),
            reminded,
            ts(t.created_at),
            ts(t.updated_at),
          ],
        );
      }

      for (const i of b.list_items) {
        const listId = ref("lists", i.list_id);
        if (!listId) continue; // its list isn't in the file or this account
        added.list_items += await insert(
          `insert into list_items (id, user_id, list_id, person_id, label, note, checked, position, created_at, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,now()),coalesce($10,now()))
           on conflict (id) do nothing`,
          [
            map.get("list_items")!.get(i.id),
            userId,
            listId,
            ref("people", i.person_id),
            i.label,
            i.note ?? null,
            i.checked ?? false,
            i.position ?? 0,
            ts(i.created_at),
            ts(i.updated_at),
          ],
        );
      }

      for (const c of b.check_ins) {
        const personId = ref("people", c.person_id);
        if (!personId) continue; // a check-in needs its person
        added.check_ins += await insert(
          `insert into check_ins (id, user_id, person_id, checked_in_at, reason, created_at, updated_at, amount_cents)
           values ($1,$2,$3,coalesce($4,now()),$5,coalesce($6,now()),coalesce($7,now()),$8)
           on conflict (id) do nothing`,
          [map.get("check_ins")!.get(c.id), userId, personId, ts(c.checked_in_at), c.reason ?? null, ts(c.created_at), ts(c.updated_at), c.amount_cents ?? null],
        );
      }

      for (const a of b.activity) {
        added.activity += await insert(
          `insert into activity (id, user_id, person_id, list_id, task_id, note_id, type, description, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,now()))
           on conflict (id) do nothing`,
          [
            map.get("activity")!.get(a.id),
            userId,
            ref("people", a.person_id),
            ref("lists", a.list_id),
            ref("tasks", a.task_id),
            ref("notes", a.note_id),
            a.type,
            a.description,
            ts(a.created_at),
          ],
        );
      }

      // Exits and outcomes: matched to this account's reasons/outcomes by name (added if missing).
      const named = async (table: "exit_reasons" | "outcomes", name: string, kind?: string): Promise<string> => {
        const found = (await q(`select id from ${table} where ${scopeSql} and lower(name) = lower($2) and archived_at is null limit 1`, [scopeParam, name])) as unknown as {
          rows: { id: string }[];
        };
        if (found.rows[0]) return found.rows[0].id;
        const made = (await q(
          table === "exit_reasons"
            ? `insert into exit_reasons (org_id, user_id, name, kind, position) values ($1, $2, $3, $4, 99) returning id`
            : `insert into outcomes (org_id, user_id, name, position) values ($1, $2, $3, 99) returning id`,
          table === "exit_reasons" ? [orgId, orgId ? null : userId, name, kind] : [orgId, orgId ? null : userId, name],
        )) as unknown as { rows: { id: string }[] };
        return made.rows[0].id;
      };
      const exited = new Set<string>();
      for (const e of b.exits) {
        const personId = ref("people", e.person_id);
        if (!personId || exitIds.ours.has(e.id) || !day(e.exited_on)) continue;
        const reasonId = await named("exit_reasons", e.reason, e.group);
        const n = await insert(
          `insert into person_exits (id, user_id, person_id, reason_id, kind, exited_on, note, reopened_at, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,now())) on conflict (id) do nothing`,
          [exitIds.map.get(e.id), userId, personId, reasonId, e.group, day(e.exited_on), e.note ?? null, ts(e.came_back_at), ts(e.created_at)],
        );
        added.exits += n;
        if (n) exited.add(personId);
      }
      if (exited.size) {
        await q(
          `update people p set exited_on = (select max(x.exited_on) from person_exits x where x.person_id = p.id and x.deleted_at is null and x.reopened_at is null)
            where p.id = any($1::uuid[])`,
          [[...exited]],
        );
      }
      for (const o of b.outcomes) {
        const personId = ref("people", o.person_id);
        if (!personId || outcomeIds.ours.has(o.id) || !day(o.achieved_on)) continue;
        const outcomeId = await named("outcomes", o.outcome);
        added.outcomes += await insert(
          `insert into person_outcomes (id, user_id, person_id, outcome_id, achieved_on, note, created_at)
           values ($1,$2,$3,$4,$5,$6,coalesce($7,now())) on conflict (id) do nothing`,
          [outcomeIds.map.get(o.id), userId, personId, outcomeId, day(o.achieved_on), o.note ?? null, ts(o.created_at)],
        );
      }

      // Business setup (forms, responses, automations, report schedules) only goes into a Business account,
      // and always comes back switched off: forms as drafts with a new link, rules and schedules off.
      if (orgId) {
        const room = async (table: string, max: number) => {
          const r = (await q(`select count(*)::int as n from ${table} where org_id = $1 and deleted_at is null`, [orgId])) as unknown as { rows: { n: number }[] };
          return Math.max(0, max - (r.rows[0]?.n ?? 0));
        };
        const kinds = Object.fromEntries(accountFields.map((f) => [f.id, f.kind]));
        const formsHere = new Set<string>([...formIds.ours]);
        let formRoom = await room("forms", 50);
        for (const f of b.forms) {
          if (formIds.ours.has(f.id) || formRoom <= 0) continue;
          let fields: FormField[] | null = null;
          try {
            fields = cleanDefinition(f.fields, kinds);
          } catch {
            try {
              // Custom fields from another account don't exist here: keep the question, drop the mapping.
              fields = cleanDefinition(
                f.fields.map((x) => (x && typeof x === "object" && String((x as { mapTo?: unknown }).mapTo ?? "").startsWith("custom:") ? { ...x, mapTo: null } : x)),
                kinds,
              );
            } catch {
              fields = null;
            }
          }
          if (!fields) continue;
          const newId = formIds.map.get(f.id)!;
          const settings = { ...cleanSettings(f.settings), assignTo: null };
          const n = await insert(
            `insert into forms (id, user_id, org_id, name, description, code, status, fields, settings, created_at)
             values ($1,$2,$3,$4,$5,$6,'draft',$7,$8,coalesce($9,now())) on conflict (id) do nothing`,
            [newId, userId, orgId, f.name, f.description ?? null, randomBytes(12).toString("base64url"), JSON.stringify(fields), JSON.stringify(settings), ts(f.created_at)],
          );
          if (n) {
            added.forms += n;
            formRoom--;
            formsHere.add(newId);
          }
        }
        const STATUSES = ["new", "needs_review", "approved", "processed", "rejected"] as const;
        for (const r of b.form_responses) {
          const formId = formIds.map.get(r.form_id);
          if (!formId || !formsHere.has(formId) || responseIds.ours.has(r.id)) continue;
          added.form_responses += await insert(
            `insert into form_submissions (id, form_id, user_id, org_id, answers, fields, status, person_id, created_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,now())) on conflict (id) do nothing`,
            [
              responseIds.map.get(r.id),
              formId,
              userId,
              orgId,
              JSON.stringify(r.answers),
              JSON.stringify(r.fields),
              oneOf(r.status, STATUSES) ?? "new",
              ref("people", r.person_id),
              ts(r.created_at),
            ],
          );
        }
        let ruleRoom = await room("workflows", 25);
        for (const w of b.automations) {
          if (workflowIds.ours.has(w.id) || ruleRoom <= 0) continue;
          // A rule for a restored form follows it to the form's new id; everything is checked again when it's turned on.
          const trigger = { ...w.trigger };
          if (typeof trigger.formId === "string") trigger.formId = formIds.map.get(trigger.formId) ?? trigger.formId;
          const n = await insert(
            `insert into workflows (id, user_id, org_id, name, enabled, trigger, conditions, actions) values ($1,$2,$3,$4,false,$5,$6,$7) on conflict (id) do nothing`,
            [workflowIds.map.get(w.id), userId, orgId, w.name, JSON.stringify(trigger), JSON.stringify(w.conditions), JSON.stringify(w.actions)],
          );
          added.automations += n;
          ruleRoom -= n;
        }
        let scheduleRoom = await room("report_schedules", 10);
        const audience = membership[0]?.kind === "business" ? "business" : "nonprofit";
        for (const s of b.report_schedules) {
          if (scheduleIds.ours.has(s.id) || scheduleRoom <= 0) continue;
          const c = cleanSchedule(
            { name: s.name, frequency: s.frequency, weekday: s.weekday, monthDay: s.month_day, hour: s.hour, recipients: s.recipients, attachPdf: s.attach_pdf === true, tiles: s.tiles },
            audience,
            true,
          );
          const n = await insert(
            `insert into report_schedules (id, user_id, org_id, name, frequency, weekday, month_day, hour, recipients, attach_pdf, tiles, enabled)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false) on conflict (id) do nothing`,
            [scheduleIds.map.get(s.id), userId, orgId, c.name, c.frequency, c.weekday, c.monthDay, c.hour, c.recipients, c.attachPdf, c.tiles],
          );
          added.report_schedules += n;
          scheduleRoom -= n;
        }
      }
    });

    return added;
  }
}
