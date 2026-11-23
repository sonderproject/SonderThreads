/**
 * Automations (When → If → Then): the rule definition, validation and evaluation.
 * No database or server imports, so the builder, the runner and the tests share the
 * exact same rules. Rule-based only: no AI anywhere in this feature.
 *
 * What a rule can never do, by design (there is no action type for it): send email or
 * texts to anyone outside the account, delete records, change roles, permissions or
 * billing, run scripts or call webhooks.
 */

export type TriggerType = "form_submitted" | "person_added" | "person_exited" | "check_in" | "no_contact" | "birthday" | "date_field";

export type Trigger =
  | { type: "form_submitted"; formId: string }
  | { type: "person_added" }
  | { type: "person_exited" }
  | { type: "check_in" }
  | { type: "no_contact"; days: number }
  | { type: "birthday"; days: number }
  | { type: "date_field"; fieldId: string; days: number };

export type ConditionOp = "is" | "is_not" | "contains" | "is_empty" | "is_not_empty";
export type Condition = { field: string; op: ConditionOp; value?: string };

export type Action =
  | { type: "create_task"; title: string; dueDays: number; assignee: string }
  | { type: "notify"; to: string; message: string }
  | { type: "add_to_list"; listId: string }
  | { type: "assign_person"; userId: string }
  | { type: "assign_response"; userId: string }
  | { type: "add_note"; text: string }
  | { type: "set_field"; fieldId: string; value: string }
  | { type: "flag_followup" }
  | { type: "set_response_status"; status: "processed" | "needs_review" };

export type Workflow = { trigger: Trigger; conditions: Condition[]; actions: Action[] };

export const WORKFLOW_LIMITS = {
  perAccount: 25,
  conditions: 10,
  actions: 5,
  /** Runs of one automation in a day. */
  runsPerDay: 100,
  /** Actions across all of an account's automations in a day. */
  actionsPerDay: 300,
  nameLength: 80,
  textLength: 500,
} as const;

/** Event triggers happen once; time triggers are checked by the 5-minute job. */
export const TRIGGERS: { type: TriggerType; label: string; hint: string; time: boolean }[] = [
  { type: "form_submitted", label: "A form response arrives", hint: "Runs for each new response to the form you pick.", time: false },
  { type: "person_added", label: "A person is added", hint: "Typed in, from a form or a referral. Imports and sample data are skipped.", time: false },
  { type: "person_exited", label: "A person is exited", hint: "When someone is marked as exited.", time: false },
  { type: "check_in", label: "A visit is logged", hint: "Each time a visit, check-in or meeting is recorded.", time: false },
  { type: "no_contact", label: "No contact for a while", hint: "Once per quiet spell: runs again only after new activity.", time: true },
  { type: "birthday", label: "A birthday is coming up", hint: "Once a year per person.", time: true },
  { type: "date_field", label: "A date field is reached", hint: "Uses one of your custom date fields, once per date.", time: true },
];
export const isTimeTrigger = (t: TriggerType) => TRIGGERS.find((x) => x.type === t)?.time ?? false;

export const ACTIONS: { type: Action["type"]; label: string; orgOnly?: boolean; formOnly?: boolean }[] = [
  { type: "create_task", label: "Create a task" },
  { type: "notify", label: "Send an in-app alert" },
  { type: "flag_followup", label: "Flag for follow-up" },
  { type: "add_note", label: "Add a note" },
  { type: "set_field", label: "Set a custom field" },
  { type: "add_to_list", label: "Add to a list" },
  { type: "assign_person", label: "Assign the person to a member", orgOnly: true },
  { type: "assign_response", label: "Assign the response to a member", orgOnly: true, formOnly: true },
  { type: "set_response_status", label: "Change the response's status", formOnly: true },
];

export const OP_LABELS: Record<ConditionOp, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  is_empty: "is empty",
  is_not_empty: "is filled in",
};

/** What the builder and validator know about the account. */
export type WorkflowContext = {
  isOrg: boolean;
  members: string[];
  lists: string[];
  services: string[];
  exitReasons: string[];
  customFields: { id: string; label?: string; kind: string; options: string[] }[];
  forms: { id: string; fields: { id: string; label?: string; type: string; options?: string[] }[] }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Which condition fields make sense for a trigger. */
export function conditionFields(trigger: Trigger, ctx: WorkflowContext): { value: string; label: string; ops: ConditionOp[]; choices?: string[] }[] {
  const out: { value: string; label: string; ops: ConditionOp[]; choices?: string[] }[] = [];
  if (trigger.type === "form_submitted") {
    const form = ctx.forms.find((f) => f.id === trigger.formId);
    for (const f of form?.fields ?? []) {
      if (f.type === "heading" || f.type === "info") continue;
      const choices = f.type === "yes_no" ? ["yes", "no"] : f.options;
      out.push({ value: `answer:${f.id}`, label: `Answer: ${f.label ?? f.id}`, ops: ["is", "is_not", "contains", "is_empty", "is_not_empty"], choices });
    }
  }
  if (trigger.type === "person_exited") {
    out.push({ value: "exit_group", label: "Exit group", ops: ["is", "is_not"], choices: ["positive", "neutral", "unplanned"] });
    out.push({ value: "exit_reason", label: "Exit reason", ops: ["is", "is_not"] });
  }
  if (trigger.type === "check_in") out.push({ value: "service", label: "Service", ops: ["is", "is_not", "is_empty", "is_not_empty"] });
  for (const c of ctx.customFields) out.push({ value: `custom:${c.id}`, label: c.label ?? "Custom field", ops: ["is", "is_not", "contains", "is_empty", "is_not_empty"], choices: c.kind === "choice" ? c.options : c.kind === "yesno" ? ["yes", "no"] : undefined });
  out.push({ value: "email", label: "Email", ops: ["is_empty", "is_not_empty"] });
  out.push({ value: "phone", label: "Phone", ops: ["is_empty", "is_not_empty"] });
  if (ctx.lists.length) out.push({ value: "list", label: "On the list", ops: ["is", "is_not"] });
  if (ctx.isOrg) out.push({ value: "owner", label: "Assigned to", ops: ["is", "is_not"] });
  return out;
}

/**
 * Cleans a rule from the builder: known types only, every id checked against the
 * account (forms, lists, members, fields), sane numbers and lengths. Throws a readable
 * message for the person editing.
 */
export function cleanWorkflow(raw: unknown, ctx: WorkflowContext): Workflow {
  const r = (raw ?? {}) as Record<string, unknown>;
  const t = (r.trigger ?? {}) as Record<string, unknown>;
  let trigger: Trigger;
  switch (t.type) {
    case "form_submitted": {
      const formId = str(t.formId, 40);
      if (!ctx.forms.some((f) => f.id === formId)) throw new Error("Pick which form this runs for.");
      trigger = { type: "form_submitted", formId };
      break;
    }
    case "person_added":
    case "person_exited":
    case "check_in":
      trigger = { type: t.type };
      break;
    case "no_contact":
      trigger = { type: "no_contact", days: int(t.days, 3, 365, 30) };
      break;
    case "birthday":
      trigger = { type: "birthday", days: int(t.days, 0, 30, 0) };
      break;
    case "date_field": {
      const fieldId = str(t.fieldId, 40);
      if (!ctx.customFields.some((c) => c.id === fieldId && c.kind === "date")) throw new Error("Pick one of your custom date fields.");
      trigger = { type: "date_field", fieldId, days: int(t.days, -60, 60, 0) };
      break;
    }
    default:
      throw new Error("Pick what starts this automation.");
  }

  const fields = conditionFields(trigger, ctx);
  const rawConds = Array.isArray(r.conditions) ? r.conditions : [];
  if (rawConds.length > WORKFLOW_LIMITS.conditions) throw new Error(`Up to ${WORKFLOW_LIMITS.conditions} conditions.`);
  const conditions: Condition[] = rawConds.map((c, i) => {
    const x = (c ?? {}) as Record<string, unknown>;
    const field = str(x.field, 60);
    const def = fields.find((f) => f.value === field);
    if (!def) throw new Error(`Condition ${i + 1} doesn't fit this trigger.`);
    const op = x.op as ConditionOp;
    if (!def.ops.includes(op)) throw new Error(`Condition ${i + 1}: pick how to compare.`);
    if (op === "is_empty" || op === "is_not_empty") return { field, op };
    const value = str(x.value, 200);
    if (!value) throw new Error(`Condition ${i + 1} needs a value.`);
    if (field === "list" && !ctx.lists.includes(value)) throw new Error(`Condition ${i + 1}: that list isn't yours.`);
    if (field === "owner" && !ctx.members.includes(value)) throw new Error(`Condition ${i + 1}: pick a member of your organization.`);
    if (field === "service" && !ctx.services.includes(value)) throw new Error(`Condition ${i + 1}: pick one of your services.`);
    if (field === "exit_reason" && !ctx.exitReasons.includes(value)) throw new Error(`Condition ${i + 1}: pick one of your exit reasons.`);
    if (field === "exit_group" && !["positive", "neutral", "unplanned"].includes(value)) throw new Error(`Condition ${i + 1}: pick an exit group.`);
    return { field, op, value };
  });

  const rawActs = Array.isArray(r.actions) ? r.actions : [];
  if (rawActs.length === 0) throw new Error("Add at least one thing for it to do.");
  if (rawActs.length > WORKFLOW_LIMITS.actions) throw new Error(`Up to ${WORKFLOW_LIMITS.actions} actions.`);
  const member = (v: unknown, i: number) => {
    const id = str(v, 40);
    if (!ctx.members.includes(id)) throw new Error(`Action ${i + 1}: pick a member of your organization.`);
    return id;
  };
  const actions: Action[] = rawActs.map((a, i) => {
    const x = (a ?? {}) as Record<string, unknown>;
    const meta = ACTIONS.find((m) => m.type === x.type);
    if (!meta) throw new Error(`Action ${i + 1} isn't something automations can do.`);
    if (meta.orgOnly && !ctx.isOrg) throw new Error(`Action ${i + 1} is only for organizations.`);
    if (meta.formOnly && trigger.type !== "form_submitted") throw new Error(`Action ${i + 1} only works when a form response starts the automation.`);
    switch (x.type) {
      case "create_task": {
        const title = str(x.title, 200);
        if (!title) throw new Error(`Action ${i + 1}: give the task a title.`);
        const assignee = x.assignee === "owner" || x.assignee === "creator" ? x.assignee : ctx.isOrg ? member(x.assignee, i) : "owner";
        return { type: "create_task", title, dueDays: int(x.dueDays, 0, 90, 0), assignee };
      }
      case "notify": {
        const message = str(x.message, 200);
        if (!message) throw new Error(`Action ${i + 1}: write the alert.`);
        const to = x.to === "owner" || x.to === "managers" ? x.to : ctx.isOrg ? member(x.to, i) : "owner";
        return { type: "notify", to: ctx.isOrg ? to : "owner", message };
      }
      case "add_to_list": {
        const listId = str(x.listId, 40);
        if (!ctx.lists.includes(listId)) throw new Error(`Action ${i + 1}: pick one of your lists.`);
        return { type: "add_to_list", listId };
      }
      case "assign_person":
        return { type: "assign_person", userId: member(x.userId, i) };
      case "assign_response":
        return { type: "assign_response", userId: member(x.userId, i) };
      case "add_note": {
        const t2 = text(x.text, WORKFLOW_LIMITS.textLength);
        if (!t2) throw new Error(`Action ${i + 1}: write the note.`);
        return { type: "add_note", text: t2 };
      }
      case "set_field": {
        const fieldId = str(x.fieldId, 40);
        const f = ctx.customFields.find((c) => c.id === fieldId);
        if (!f) throw new Error(`Action ${i + 1}: pick one of your custom fields.`);
        const value = str(x.value, 200);
        if (!value) throw new Error(`Action ${i + 1}: enter the value to set.`);
        if (f.kind === "choice" && !f.options.includes(value)) throw new Error(`Action ${i + 1}: pick one of that field's choices.`);
        if (f.kind === "yesno" && value !== "yes" && value !== "no") throw new Error(`Action ${i + 1}: choose yes or no.`);
        if (f.kind === "number" && !Number.isFinite(Number(value))) throw new Error(`Action ${i + 1}: enter a number.`);
        if (f.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Action ${i + 1}: enter a date.`);
        return { type: "set_field", fieldId, value };
      }
      case "flag_followup":
        return { type: "flag_followup" };
      case "set_response_status":
        return { type: "set_response_status", status: x.status === "needs_review" ? "needs_review" : "processed" };
      default:
        throw new Error(`Action ${i + 1} isn't something automations can do.`);
    }
  });
  return { trigger, conditions, actions };
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

/** Everything a condition can look at, loaded by the runner for one person and event. */
export type EvalContext = {
  person: { email: string | null; phone: string | null; ownerId: string; custom: Record<string, string>; listIds: string[] };
  answers?: Record<string, string | string[] | number | boolean>;
  exit?: { kind: string; reasonId: string };
  serviceId?: string | null;
};

function valueOf(field: string, ctx: EvalContext): string | string[] | null {
  if (field.startsWith("answer:")) {
    const a = ctx.answers?.[field.slice(7)];
    if (a === undefined || a === null || a === "") return null;
    if (Array.isArray(a)) return a.length ? a.map(String) : null;
    if (typeof a === "boolean") return a ? "yes" : null;
    return String(a);
  }
  if (field.startsWith("custom:")) return ctx.person.custom[field.slice(7)] || null;
  switch (field) {
    case "email":
      return ctx.person.email || null;
    case "phone":
      return ctx.person.phone || null;
    case "owner":
      return ctx.person.ownerId;
    case "list":
      return ctx.person.listIds.length ? ctx.person.listIds : null;
    case "exit_group":
      return ctx.exit?.kind ?? null;
    case "exit_reason":
      return ctx.exit?.reasonId ?? null;
    case "service":
      return ctx.serviceId ?? null;
    default:
      return null;
  }
}

/** True when every condition holds (no conditions = always). Text compares ignore case. */
export function matches(conditions: Condition[], ctx: EvalContext): boolean {
  return conditions.every((c) => {
    const v = valueOf(c.field, ctx);
    const values = v === null ? [] : Array.isArray(v) ? v : [v];
    const want = (c.value ?? "").toLowerCase();
    const lower = values.map((x) => x.toLowerCase());
    switch (c.op) {
      case "is_empty":
        return values.length === 0;
      case "is_not_empty":
        return values.length > 0;
      case "is":
        return lower.includes(want);
      case "is_not":
        return !lower.includes(want);
      case "contains":
        return lower.some((x) => x.includes(want));
      default:
        return false;
    }
  });
}

/** "{name}" in a task title becomes the person's name (tasks stay private to whoever gets them). */
export function taskTitle(title: string, name: string): string {
  return title.replace(/\{name\}/g, name).slice(0, 300);
}

export const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/* ------------------------------------------------------------------ */
/* Starter automations                                                 */
/* ------------------------------------------------------------------ */

export type WorkflowTemplate = { key: string; name: string; description: string; needs?: "form"; workflow: Omit<Workflow, "trigger"> & { trigger: Partial<Trigger> & { type: TriggerType } } };

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "review-responses",
    name: "Review new form responses",
    description: "A task to look at each new response the same day.",
    needs: "form",
    workflow: { trigger: { type: "form_submitted" }, conditions: [], actions: [{ type: "create_task", title: "Review a new form response", dueDays: 0, assignee: "creator" }] },
  },
  {
    key: "welcome-call",
    name: "Welcome call for new people",
    description: "Three days after someone is added, a task to call them.",
    workflow: { trigger: { type: "person_added" }, conditions: [], actions: [{ type: "create_task", title: "Welcome call with {name}", dueDays: 3, assignee: "owner" }] },
  },
  {
    key: "unplanned-exit",
    name: "Follow up on unplanned exits",
    description: "When an exit is unplanned, flag it and add a task to try to reconnect in a week.",
    workflow: {
      trigger: { type: "person_exited" },
      conditions: [{ field: "exit_group", op: "is", value: "unplanned" }],
      actions: [
        { type: "flag_followup" },
        { type: "create_task", title: "Try to reconnect with {name}", dueDays: 7, assignee: "owner" },
      ],
    },
  },
  {
    key: "gone-quiet",
    name: "Nobody falls through the cracks",
    description: "No contact in 30 days: flag for follow-up and add a check-in task.",
    workflow: {
      trigger: { type: "no_contact", days: 30 },
      conditions: [],
      actions: [{ type: "flag_followup" }, { type: "create_task", title: "Check in with {name}", dueDays: 0, assignee: "owner" }],
    },
  },
  {
    key: "after-visit",
    name: "Ask for feedback after a visit",
    description: "Two days after a visit, a task to ask how it went.",
    workflow: { trigger: { type: "check_in" }, conditions: [], actions: [{ type: "create_task", title: "Ask {name} how the visit went", dueDays: 2, assignee: "owner" }] },
  },
  {
    key: "birthday",
    name: "Birthday wishes",
    description: "A task on each person's birthday.",
    workflow: { trigger: { type: "birthday", days: 0 }, conditions: [], actions: [{ type: "create_task", title: "Wish {name} a happy birthday", dueDays: 0, assignee: "owner" }] },
  },
  {
    key: "missing-contact",
    name: "Fill in missing contact details",
    description: "When someone is added without a phone number, a task to get one.",
    workflow: {
      trigger: { type: "person_added" },
      conditions: [{ field: "phone", op: "is_empty" }],
      actions: [{ type: "create_task", title: "Get a phone number for {name}", dueDays: 1, assignee: "owner" }],
    },
  },
];

/** Plain-language summary of a rule, for lists and the run log. */
export function describeTrigger(t: Trigger, names: { forms: Record<string, string>; fields: Record<string, string> }): string {
  switch (t.type) {
    case "form_submitted":
      return `When "${names.forms[t.formId] ?? "a form"}" gets a response`;
    case "person_added":
      return "When a person is added";
    case "person_exited":
      return "When a person is exited";
    case "check_in":
      return "When a visit is logged";
    case "no_contact":
      return `When someone has had no contact for ${t.days} days`;
    case "birthday":
      return t.days === 0 ? "On someone's birthday" : `${t.days} days before someone's birthday`;
    case "date_field": {
      const f = names.fields[t.fieldId] ?? "a date field";
      return t.days === 0 ? `On the date in "${f}"` : t.days > 0 ? `${t.days} days after "${f}"` : `${-t.days} days before "${f}"`;
    }
  }
}
