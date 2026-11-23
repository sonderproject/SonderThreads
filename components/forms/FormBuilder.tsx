"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveForm } from "@/lib/actions/forms";
import { FieldInput } from "./PublicFormView";
import {
  FIELD_TYPES,
  FORM_LIMITS,
  MAP_LABELS,
  customKindsFor,
  hasOptions,
  isInputField,
  mapTargetsFor,
  newFieldId,
  type FormField,
  type FormFieldType,
  type FormSettings,
} from "@/lib/forms-shared";

type CustomFieldOption = { id: string; label: string; kind: string };
type Member = { id: string; name: string };

const small = "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-bg-hover disabled:opacity-40";
const RETENTION = [
  { value: "", label: "Keep until deleted" },
  { value: "30", label: "Delete after 30 days" },
  { value: "90", label: "Delete after 90 days" },
  { value: "180", label: "Delete after 6 months" },
  { value: "365", label: "Delete after 1 year" },
];

/** Datetime-local value (local time) from an ISO string, and back. */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** The form builder: questions, profile mapping, intake settings and a live preview. Saves with one button. */
export function FormBuilder({
  formId,
  initial,
  customFields,
  members,
  canEdit,
}: {
  formId: string;
  initial: { name: string; description: string | null; fields: FormField[]; settings: FormSettings };
  customFields: CustomFieldOption[];
  members: Member[];
  canEdit: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [fields, setFields] = useState<FormField[]>(initial.fields);
  const [settings, setSettings] = useState<FormSettings>(initial.settings);
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">(canEdit ? "edit" : "preview");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setDirty(true);
    setMsg(null);
  };
  const setField = (id: string, patch: Partial<FormField>) => change(() => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f))))(null);
  const move = (from: number, to: number) =>
    change(() =>
      setFields((fs) => {
        if (to < 0 || to >= fs.length) return fs;
        const next = [...fs];
        const [x] = next.splice(from, 1);
        next.splice(to, 0, x);
        return next;
      }),
    )(null);
  const add = (type: FormFieldType) => {
    const meta = FIELD_TYPES.find((t) => t.type === type)!;
    const f: FormField = { id: newFieldId(), type, label: type === "consent" ? "I agree to be contacted about my request." : meta.label };
    if (hasOptions(type)) f.options = ["Option 1", "Option 2"];
    change(() => setFields((fs) => [...fs, f]))(null);
    setOpen(f.id);
  };

  /** Profile targets already used by another field (each can be filled once). */
  const used = useMemo(() => new Set(fields.map((f) => f.mapTo).filter(Boolean) as string[]), [fields]);

  const save = () =>
    start(async () => {
      const r = await saveForm(formId, { name, description, fields, settings });
      if (r.ok) {
        setDirty(false);
        setMsg({ ok: true, text: "Saved." });
      } else setMsg({ ok: false, text: r.error });
    });

  const inputs = fields.filter((f) => isInputField(f.type)).length;

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-bg/90 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3">
        <div className="inline-flex rounded-full border border-border bg-bg-raised p-0.5 text-sm" role="group" aria-label="Builder view">
          {canEdit && (
            <button type="button" onClick={() => setView("edit")} aria-pressed={view === "edit"} className={`rounded-full px-3 py-1 ${view === "edit" ? "bg-accent text-bg" : "text-text-muted"}`}>
              Edit
            </button>
          )}
          <button type="button" onClick={() => setView("preview")} aria-pressed={view === "preview"} className={`rounded-full px-3 py-1 ${view === "preview" ? "bg-accent text-bg" : "text-text-muted"}`}>
            Preview
          </button>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <span className={`text-xs ${msg ? (msg.ok ? "text-accent" : "text-urgent") : "text-text-faint"}`} role="status" aria-live="polite">
              {msg?.text ?? (dirty ? "Unsaved changes" : `${inputs} question${inputs === 1 ? "" : "s"}`)}
            </span>
            <button type="button" onClick={save} disabled={pending || !dirty} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {view === "preview" ? (
        <div className="mx-auto max-w-xl space-y-5">
          <div className="space-y-2 text-center">
            <h2 className="page-title">{name || "Untitled form"}</h2>
            {description && <p className="whitespace-pre-line text-sm text-text-muted">{description}</p>}
          </div>
          <div className="card space-y-5 p-5">
            {fields.map((f) => (
              <FieldInput key={f.id} f={f} disabled />
            ))}
            <button type="button" disabled className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg opacity-60">
              Send
            </button>
          </div>
          <p className="text-center text-xs text-text-faint">Preview only. Nothing you enter here is sent.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="card space-y-3 p-4">
              <label className="block space-y-1 text-sm">
                <span className="section-label">Form name</span>
                <input value={name} maxLength={120} onChange={(e) => change(setName)(e.target.value)} className="input text-base font-semibold" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="section-label">Intro (optional)</span>
                <textarea
                  value={description}
                  maxLength={FORM_LIMITS.descriptionLength}
                  rows={2}
                  onChange={(e) => change(setDescription)(e.target.value)}
                  placeholder="A sentence about what this form is for."
                  className="input"
                />
              </label>
            </div>

            <ol className="space-y-2" aria-label="Fields">
              {fields.map((f, i) => {
                const meta = FIELD_TYPES.find((t) => t.type === f.type);
                const expanded = open === f.id;
                const targets = isInputField(f.type)
                  ? [
                      ...mapTargetsFor(f.type).map((t) => ({ value: t, label: MAP_LABELS[t] })),
                      ...customFields
                        .filter((c) => (customKindsFor(f.type) as string[]).includes(c.kind))
                        .map((c) => ({ value: `custom:${c.id}`, label: `${c.label} (custom field)` })),
                    ]
                  : [];
                return (
                  <li
                    key={f.id}
                    draggable
                    onDragStart={() => (dragFrom.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragFrom.current !== null && dragFrom.current !== i) move(dragFrom.current, i);
                      dragFrom.current = null;
                    }}
                    className={`card overflow-hidden ${expanded ? "ring-1 ring-accent" : ""}`}
                  >
                    <div className="flex items-center gap-2 p-3">
                      <span className="cursor-grab select-none px-1 text-text-faint" aria-hidden title="Drag to reorder">
                        ⋮⋮
                      </span>
                      <button type="button" onClick={() => setOpen(expanded ? null : f.id)} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium text-text">
                          {f.label}
                          {f.required && <span className="text-urgent"> *</span>}
                        </span>
                        <span className="block text-xs text-text-faint">
                          {meta?.label}
                          {f.mapTo ? ` → ${f.mapTo.startsWith("custom:") ? (customFields.find((c) => `custom:${c.id}` === f.mapTo)?.label ?? "custom field") : MAP_LABELS[f.mapTo]}` : ""}
                        </span>
                      </button>
                      <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className={small} aria-label={`Move ${f.label} up`}>
                        ↑
                      </button>
                      <button type="button" onClick={() => move(i, i + 1)} disabled={i === fields.length - 1} className={small} aria-label={`Move ${f.label} down`}>
                        ↓
                      </button>
                    </div>
                    {expanded && (
                      <div className="space-y-3 border-t border-border-subtle p-3">
                        <label className="block space-y-1 text-sm">
                          <span className="text-text-muted">{f.type === "heading" ? "Heading" : f.type === "info" ? "Title" : "Question"}</span>
                          <input value={f.label} maxLength={FORM_LIMITS.labelLength} onChange={(e) => setField(f.id, { label: e.target.value })} className="input" />
                        </label>
                        <label className="block space-y-1 text-sm">
                          <span className="text-text-muted">{f.type === "info" ? "Text" : "Help text (optional)"}</span>
                          <textarea
                            value={f.description ?? ""}
                            rows={2}
                            maxLength={FORM_LIMITS.descriptionLength}
                            onChange={(e) => setField(f.id, { description: e.target.value || undefined })}
                            className="input"
                          />
                        </label>
                        {hasOptions(f.type) && (
                          <label className="block space-y-1 text-sm">
                            <span className="text-text-muted">Options, one per line</span>
                            <textarea
                              value={(f.options ?? []).join("\n")}
                              rows={Math.min(8, Math.max(3, (f.options ?? []).length + 1))}
                              onChange={(e) => setField(f.id, { options: e.target.value.split("\n").slice(0, FORM_LIMITS.optionsPerField) })}
                              className="input"
                            />
                          </label>
                        )}
                        {f.type === "number" && (
                          <div className="grid grid-cols-2 gap-3">
                            {(["min", "max"] as const).map((k) => (
                              <label key={k} className="space-y-1 text-sm">
                                <span className="text-text-muted">{k === "min" ? "Lowest" : "Highest"} (optional)</span>
                                <input
                                  type="number"
                                  value={f[k] ?? ""}
                                  onChange={(e) => setField(f.id, { [k]: e.target.value === "" ? undefined : Number(e.target.value) })}
                                  className="input tabular-nums"
                                />
                              </label>
                            ))}
                          </div>
                        )}
                        {(f.type === "short_text" || f.type === "long_text" || f.type === "email" || f.type === "phone" || f.type === "number") && (
                          <label className="block space-y-1 text-sm">
                            <span className="text-text-muted">Placeholder (optional)</span>
                            <input value={f.placeholder ?? ""} maxLength={120} onChange={(e) => setField(f.id, { placeholder: e.target.value || undefined })} className="input" />
                          </label>
                        )}
                        {targets.length > 0 && (
                          <label className="block space-y-1 text-sm">
                            <span className="text-text-muted">Fills on the profile</span>
                            <select value={f.mapTo ?? ""} onChange={(e) => setField(f.id, { mapTo: (e.target.value || null) as FormField["mapTo"] })} className="input">
                              <option value="">Nothing (goes in the intake note)</option>
                              {targets.map((t) => (
                                <option key={t.value} value={t.value} disabled={used.has(t.value) && f.mapTo !== t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          {isInputField(f.type) ? (
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={Boolean(f.required)} onChange={(e) => setField(f.id, { required: e.target.checked || undefined })} className="accent-[var(--color-accent)]" />
                              Required
                            </label>
                          ) : (
                            <span />
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className={small}
                              disabled={fields.length >= FORM_LIMITS.fieldsPerForm}
                              onClick={() => change(() => setFields((fs) => [...fs.slice(0, i + 1), { ...f, id: newFieldId(), mapTo: undefined, label: `${f.label} (copy)` }, ...fs.slice(i + 1)]))(null)}
                            >
                              Duplicate
                            </button>
                            <button type="button" className={`${small} text-urgent`} onClick={() => change(() => setFields((fs) => fs.filter((x) => x.id !== f.id)))(null)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="card space-y-2 p-3">
              <p className="section-label">Add a field</p>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_TYPES.map((t) => (
                  <button key={t.type} type="button" onClick={() => add(t.type)} disabled={fields.length >= FORM_LIMITS.fieldsPerForm} className={small}>
                    + {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
            <div className="card space-y-3 p-4">
              <p className="section-label">When someone sends it</p>
              {(
                [
                  ["review", "Review first", "Each response waits for you. Approve to add the person."],
                  ["auto", "Add people automatically", "A new profile is made when nobody matches. Possible duplicates still wait for review."],
                  ["none", "Just collect answers", "Feedback, surveys, sign-ups. No profiles are made."],
                ] as const
              ).map(([v, label, hint]) => (
                <label key={v} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border-subtle p-2.5 text-sm has-[:checked]:border-accent">
                  <input type="radio" name="intake" checked={settings.intake === v} onChange={() => change(setSettings)({ ...settings, intake: v })} className="mt-0.5 accent-[var(--color-accent)]" />
                  <span>
                    <span className="block font-medium text-text">{label}</span>
                    <span className="block text-xs text-text-muted">{hint}</span>
                  </span>
                </label>
              ))}
              {members.length > 0 && (
                <label className="block space-y-1 text-sm">
                  <span className="text-text-muted">Assign responses to</span>
                  <select value={settings.assignTo ?? ""} onChange={(e) => change(setSettings)({ ...settings, assignTo: e.target.value || null })} className="input">
                    <option value="">Admins and Managers</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs text-text-faint">They&apos;re notified, and new profiles are theirs.</span>
                </label>
              )}
            </div>

            <div className="card space-y-3 p-4">
              <p className="section-label">Limits and privacy</p>
              <label className="block space-y-1 text-sm">
                <span className="text-text-muted">Close on (optional)</span>
                <input
                  type="datetime-local"
                  value={toLocal(settings.closesAt)}
                  onChange={(e) => change(setSettings)({ ...settings, closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="input tabular-nums"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-text-muted">Stop after this many responses (optional)</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={settings.maxSubmissions ?? ""}
                  onChange={(e) => change(setSettings)({ ...settings, maxSubmissions: e.target.value ? Number(e.target.value) : null })}
                  className="input tabular-nums"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-text-muted">Keep responses</span>
                <select
                  value={settings.retentionDays ? String(settings.retentionDays) : ""}
                  onChange={(e) => change(setSettings)({ ...settings, retentionDays: e.target.value ? Number(e.target.value) : null })}
                  className="input"
                >
                  {RETENTION.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-text-faint">Profiles and notes already added are kept.</span>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-text-muted">Thank-you message</span>
                <textarea
                  value={settings.successMessage}
                  rows={2}
                  maxLength={FORM_LIMITS.successMessage}
                  onChange={(e) => change(setSettings)({ ...settings, successMessage: e.target.value })}
                  className="input"
                />
              </label>
            </div>
            <p className="px-1 text-xs text-text-faint">
              Don&apos;t ask for Social Security numbers, medical details or ID numbers on a form.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
