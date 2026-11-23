"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveWorkflow, testWorkflow } from "@/lib/actions/workflows";
import type { BuilderData } from "@/lib/workflows";
import type { Preview } from "@/lib/workflows";
import {
  ACTIONS,
  OP_LABELS,
  TRIGGERS,
  WORKFLOW_LIMITS,
  conditionFields,
  type Action,
  type Condition,
  type ConditionOp,
  type Trigger,
  type TriggerType,
} from "@/lib/workflows-shared";

const small = "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-bg-hover disabled:opacity-40";
const DUE = [0, 1, 2, 3, 7, 14, 30];
const STEP = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent";

type Draft = { trigger: Partial<Trigger> & { type: TriggerType }; conditions: Condition[]; actions: Action[] };

function blankAction(type: Action["type"]): Action {
  switch (type) {
    case "create_task":
      return { type, title: "Follow up with {name}", dueDays: 1, assignee: "owner" };
    case "notify":
      return { type, to: "managers", message: "" };
    case "add_to_list":
      return { type, listId: "" };
    case "assign_person":
    case "assign_response":
      return { type, userId: "" };
    case "add_note":
      return { type, text: "" };
    case "set_field":
      return { type, fieldId: "", value: "" };
    case "set_response_status":
      return { type, status: "processed" };
    default:
      return { type: "flag_followup" };
  }
}

/** When → If → Then. Saves the rule; "Test" shows who it would match without doing anything. */
export function WorkflowBuilder({
  id,
  initial,
  data,
  canEdit,
}: {
  id: string;
  initial: { name: string; enabled: boolean; workflow: Draft };
  data: BuilderData;
  canEdit: boolean;
}) {
  const { names, ctx } = data;
  const [name, setName] = useState(initial.name);
  const [d, setD] = useState<Draft>(initial.workflow);
  const [dirty, setDirty] = useState(false);
  const [on, setOn] = useState(initial.enabled);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (next: Draft) => {
    setD(next);
    setDirty(true);
    setMsg(null);
    setPreview(null);
  };
  const fields = useMemo(() => conditionFields(d.trigger as Trigger, ctx), [d.trigger, ctx]);
  const isForm = d.trigger.type === "form_submitted";
  const availableActions = ACTIONS.filter((a) => (!a.orgOnly || ctx.isOrg) && (!a.formOnly || isForm));
  const memberName = (uid: string) => names.members.find((m) => m.id === uid)?.name ?? "a member";

  const save = (enabled?: boolean) =>
    start(async () => {
      const r = await saveWorkflow(id, { name, workflow: d, enabled });
      if (r.ok) {
        setDirty(false);
        if (enabled) setOn(true);
        setMsg({ ok: true, text: enabled ? "Saved and turned on." : "Saved." });
      } else setMsg({ ok: false, text: r.error });
    });
  const test = () =>
    start(async () => {
      const r = await testWorkflow({ workflow: d });
      if (r.ok) setPreview(r.preview);
      else setMsg({ ok: false, text: r.error });
    });

  const setTrigger = (type: TriggerType) => {
    const t: Draft["trigger"] =
      type === "no_contact" ? { type, days: 30 } : type === "birthday" ? { type, days: 0 } : type === "date_field" ? { type, fieldId: "", days: 0 } : type === "form_submitted" ? { type, formId: "" } : { type };
    const keepActions = d.actions.filter((a) => type === "form_submitted" || (a.type !== "assign_response" && a.type !== "set_response_status"));
    update({ trigger: t, conditions: [], actions: keepActions.length ? keepActions : [blankAction("create_task")] });
  };
  const setCond = (i: number, c: Condition) => update({ ...d, conditions: d.conditions.map((x, j) => (j === i ? c : x)) });
  const setAct = (i: number, a: Action) => update({ ...d, actions: d.actions.map((x, j) => (j === i ? a : x)) });

  const valueInput = (c: Condition, i: number) => {
    if (c.op === "is_empty" || c.op === "is_not_empty") return null;
    const def = fields.find((f) => f.value === c.field);
    const opts: { id: string; name: string }[] | null =
      c.field === "list"
        ? names.lists
        : c.field === "owner"
          ? names.members
          : c.field === "service"
            ? names.services
            : c.field === "exit_reason"
              ? names.exitReasons
              : def?.choices && c.op !== "contains"
                ? def.choices.map((x) => ({ id: x, name: x === "yes" ? "Yes" : x === "no" ? "No" : x.charAt(0).toUpperCase() + x.slice(1) }))
                : null;
    if (opts) {
      return (
        <select aria-label="Value" value={c.value ?? ""} onChange={(e) => setCond(i, { ...c, value: e.target.value })} className="input" disabled={!canEdit}>
          <option value="">Choose…</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      );
    }
    return <input aria-label="Value" value={c.value ?? ""} maxLength={200} onChange={(e) => setCond(i, { ...c, value: e.target.value })} className="input" disabled={!canEdit} />;
  };

  const memberSelect = (value: string, onChange: (v: string) => void, extra: { value: string; label: string }[] = []) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input" disabled={!canEdit} aria-label="Who">
      {!extra.length && <option value="">Choose a member…</option>}
      {extra.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {ctx.isOrg &&
        names.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
    </select>
  );

  const actionEditor = (a: Action, i: number) => {
    switch (a.type) {
      case "create_task":
        return (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">Task</span>
              <input value={a.title} maxLength={200} onChange={(e) => setAct(i, { ...a, title: e.target.value })} className="input" disabled={!canEdit} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">Due</span>
              <select value={a.dueDays} onChange={(e) => setAct(i, { ...a, dueDays: Number(e.target.value) })} className="input" disabled={!canEdit}>
                {DUE.map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Same day" : `${n} day${n === 1 ? "" : "s"} later`}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">For</span>
              {memberSelect(a.assignee, (v) => setAct(i, { ...a, assignee: v }), [
                { value: "owner", label: ctx.isOrg ? "Whoever the person is assigned to" : "Me" },
                ...(ctx.isOrg ? [{ value: "creator", label: "Me" }] : []),
              ])}
            </label>
            <p className="text-xs text-text-faint sm:col-span-3">Write {"{name}"} to put the person&apos;s name in the task.</p>
          </div>
        );
      case "notify":
        return (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">Message</span>
              <input value={a.message} maxLength={200} onChange={(e) => setAct(i, { ...a, message: e.target.value })} placeholder="A new housing request came in." className="input" disabled={!canEdit} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">To</span>
              {ctx.isOrg ? (
                memberSelect(a.to, (v) => setAct(i, { ...a, to: v }), [
                  { value: "managers", label: "Admins and Managers" },
                  { value: "owner", label: "Whoever the person is assigned to" },
                ])
              ) : (
                <input value="Me" readOnly className="input" />
              )}
            </label>
            <p className="text-xs text-text-faint sm:col-span-2">Shows in Notifications and as a phone alert. It links to the person; keep client details out of the message.</p>
          </div>
        );
      case "add_note":
        return (
          <label className="block space-y-1 text-sm">
            <span className="text-text-muted">Note</span>
            <textarea value={a.text} rows={2} maxLength={WORKFLOW_LIMITS.textLength} onChange={(e) => setAct(i, { ...a, text: e.target.value })} className="input" disabled={!canEdit} />
          </label>
        );
      case "set_field": {
        const f = names.customFields.find((x) => x.id === a.fieldId);
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">Field</span>
              <select value={a.fieldId} onChange={(e) => setAct(i, { ...a, fieldId: e.target.value, value: "" })} className="input" disabled={!canEdit}>
                <option value="">Choose a field…</option>
                {names.customFields.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-text-muted">Set to</span>
              {f?.kind === "choice" || f?.kind === "yesno" ? (
                <select value={a.value} onChange={(e) => setAct(i, { ...a, value: e.target.value })} className="input" disabled={!canEdit}>
                  <option value="">Choose…</option>
                  {(f.kind === "yesno" ? ["yes", "no"] : f.options).map((o) => (
                    <option key={o} value={o}>
                      {o === "yes" ? "Yes" : o === "no" ? "No" : o}
                    </option>
                  ))}
                </select>
              ) : (
                <input type={f?.kind === "date" ? "date" : f?.kind === "number" ? "number" : "text"} value={a.value} onChange={(e) => setAct(i, { ...a, value: e.target.value })} className="input" disabled={!canEdit} />
              )}
            </label>
          </div>
        );
      }
      case "add_to_list":
        return (
          <label className="block space-y-1 text-sm">
            <span className="text-text-muted">List</span>
            <select value={a.listId} onChange={(e) => setAct(i, { ...a, listId: e.target.value })} className="input" disabled={!canEdit}>
              <option value="">Choose one of your lists…</option>
              {names.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        );
      case "assign_person":
      case "assign_response":
        return (
          <label className="block space-y-1 text-sm">
            <span className="text-text-muted">Member</span>
            {memberSelect(a.userId, (v) => setAct(i, { ...a, userId: v }))}
          </label>
        );
      case "set_response_status":
        return (
          <label className="block space-y-1 text-sm">
            <span className="text-text-muted">Status</span>
            <select value={a.status} onChange={(e) => setAct(i, { ...a, status: e.target.value === "needs_review" ? "needs_review" : "processed" })} className="input" disabled={!canEdit}>
              <option value="processed">Processed</option>
              <option value="needs_review">Needs review</option>
            </select>
          </label>
        );
      default:
        return <p className="text-sm text-text-muted">Sets the &ldquo;needs follow-up&rdquo; flag on the person.</p>;
    }
  };

  const triggerMeta = TRIGGERS.find((t) => t.type === d.trigger.type);

  return (
    <div className="space-y-4">
      <div className="card space-y-1 p-4">
        <label className="block space-y-1 text-sm">
          <span className="section-label">Name</span>
          <input value={name} maxLength={WORKFLOW_LIMITS.nameLength} onChange={(e) => (setName(e.target.value), setDirty(true), setMsg(null))} className="input text-base font-semibold" disabled={!canEdit} />
        </label>
      </div>

      <section className="card space-y-3 p-4" aria-labelledby="when">
        <div className="flex items-center gap-3">
          <span className={STEP}>1</span>
          <h2 id="when" className="font-semibold text-text">
            When
          </h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="Trigger" value={d.trigger.type} onChange={(e) => setTrigger(e.target.value as TriggerType)} className="input" disabled={!canEdit}>
            {TRIGGERS.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
          {d.trigger.type === "form_submitted" && (
            <select aria-label="Form" value={d.trigger.formId ?? ""} onChange={(e) => update({ ...d, trigger: { type: "form_submitted", formId: e.target.value }, conditions: [] })} className="input" disabled={!canEdit}>
              <option value="">Choose a form…</option>
              {names.forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {d.trigger.type === "no_contact" && (
            <select aria-label="Days" value={d.trigger.days ?? 30} onChange={(e) => update({ ...d, trigger: { type: "no_contact", days: Number(e.target.value) } })} className="input" disabled={!canEdit}>
              {[7, 14, 21, 30, 45, 60, 90].map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </select>
          )}
          {d.trigger.type === "birthday" && (
            <select aria-label="When" value={d.trigger.days ?? 0} onChange={(e) => update({ ...d, trigger: { type: "birthday", days: Number(e.target.value) } })} className="input" disabled={!canEdit}>
              {[0, 1, 3, 7, 14].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "On the day" : `${n} day${n === 1 ? "" : "s"} before`}
                </option>
              ))}
            </select>
          )}
          {d.trigger.type === "date_field" && (
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Date field" value={d.trigger.fieldId ?? ""} onChange={(e) => update({ ...d, trigger: { ...(d.trigger as Trigger & { type: "date_field" }), fieldId: e.target.value } })} className="input" disabled={!canEdit}>
                <option value="">Date field…</option>
                {names.customFields
                  .filter((c) => c.kind === "date")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </select>
              <select aria-label="Offset" value={d.trigger.days ?? 0} onChange={(e) => update({ ...d, trigger: { ...(d.trigger as Trigger & { type: "date_field" }), days: Number(e.target.value) } })} className="input" disabled={!canEdit}>
                {[-30, -14, -7, -3, -1, 0, 1, 3, 7, 14, 30].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "On the date" : n < 0 ? `${-n} days before` : `${n} days after`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {triggerMeta && <p className="text-xs text-text-faint">{triggerMeta.hint}</p>}
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="if">
        <div className="flex items-center gap-3">
          <span className={STEP}>2</span>
          <h2 id="if" className="font-semibold text-text">
            If <span className="text-sm font-normal text-text-muted">(optional: all must match)</span>
          </h2>
        </div>
        {d.conditions.length === 0 && <p className="text-sm text-text-muted">Runs every time. Add a condition to narrow it down.</p>}
        <ul className="space-y-2">
          {d.conditions.map((c, i) => {
            const def = fields.find((f) => f.value === c.field);
            return (
              <li key={i} className="grid gap-2 rounded-xl border border-border-subtle p-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                <select aria-label="Field" value={c.field} onChange={(e) => setCond(i, { field: e.target.value, op: fields.find((f) => f.value === e.target.value)?.ops[0] ?? "is" })} className="input" disabled={!canEdit}>
                  {fields.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select aria-label="Comparison" value={c.op} onChange={(e) => setCond(i, { ...c, op: e.target.value as ConditionOp })} className="input" disabled={!canEdit}>
                  {(def?.ops ?? ["is"]).map((o) => (
                    <option key={o} value={o}>
                      {OP_LABELS[o]}
                    </option>
                  ))}
                </select>
                {valueInput(c, i) ?? <span />}
                {canEdit && (
                  <button type="button" className={small} onClick={() => update({ ...d, conditions: d.conditions.filter((_, j) => j !== i) })} aria-label="Remove condition">
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {canEdit && (
          <button
            type="button"
            className={small}
            disabled={d.conditions.length >= WORKFLOW_LIMITS.conditions || fields.length === 0}
            onClick={() => update({ ...d, conditions: [...d.conditions, { field: fields[0].value, op: fields[0].ops[0] }] })}
          >
            + Add a condition
          </button>
        )}
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="then">
        <div className="flex items-center gap-3">
          <span className={STEP}>3</span>
          <h2 id="then" className="font-semibold text-text">
            Then
          </h2>
        </div>
        <ol className="space-y-2">
          {d.actions.map((a, i) => (
            <li key={i} className="space-y-2 rounded-xl border border-border-subtle p-3">
              <div className="flex items-center justify-between gap-2">
                <select aria-label="Action" value={a.type} onChange={(e) => setAct(i, blankAction(e.target.value as Action["type"]))} className="input max-w-xs font-medium" disabled={!canEdit}>
                  {availableActions.map((x) => (
                    <option key={x.type} value={x.type}>
                      {x.label}
                    </option>
                  ))}
                </select>
                {canEdit && d.actions.length > 1 && (
                  <button type="button" className={small} onClick={() => update({ ...d, actions: d.actions.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                )}
              </div>
              {actionEditor(a, i)}
            </li>
          ))}
        </ol>
        {canEdit && (
          <button type="button" className={small} disabled={d.actions.length >= WORKFLOW_LIMITS.actions} onClick={() => update({ ...d, actions: [...d.actions, blankAction("create_task")] })}>
            + Add an action
          </button>
        )}
        <p className="text-xs text-text-faint">
          Automations work inside Surfdesk only. They never email or text anyone, delete anything, or change roles or billing.
          {ctx.isOrg && d.actions.some((a) => a.type === "assign_person") ? ` Assigning moves the person to ${memberName((d.actions.find((a) => a.type === "assign_person") as { userId: string }).userId)}.` : ""}
        </p>
      </section>

      {preview && (
        <div className="card space-y-2 p-4" role="status">
          <p className="section-label">Test result</p>
          <p className="text-sm text-text">
            {preview.window === "last 30 days"
              ? `In the last 30 days this would have run ${preview.matched} time${preview.matched === 1 ? "" : "s"} (out of ${preview.considered}).`
              : `Right now it would run for ${preview.matched} ${preview.matched === 1 ? "person" : "people"}.`}{" "}
            Nothing was changed.
          </p>
          {preview.names.length > 0 && <p className="text-xs text-text-muted">For example: {preview.names.join(", ")}.</p>}
        </div>
      )}

      {canEdit && (
        <div className="z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-border-subtle bg-bg/90 p-2 backdrop-blur sm:sticky sm:bottom-2">
          <span className={`mr-auto px-2 text-xs ${msg ? (msg.ok ? "text-accent" : "text-urgent") : "text-text-faint"}`} role="status" aria-live="polite">
            {msg?.text ?? (dirty ? "Unsaved changes" : on ? "On" : "Off")}
          </span>
          <button type="button" onClick={test} disabled={pending} className={`${small} py-2 text-sm`}>
            Test this rule
          </button>
          <button type="button" onClick={() => save()} disabled={pending || !dirty} className={`${small} py-2 text-sm`}>
            Save
          </button>
          {!on && (
            <button type="button" onClick={() => save(true)} disabled={pending} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50">
              Save and turn on
            </button>
          )}
        </div>
      )}
    </div>
  );
}
