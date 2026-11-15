"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomField, moveCustomField, setCustomFieldArchived, updateCustomField } from "@/lib/actions/custom-fields";
import { FIELD_KINDS, MAX_FIELDS, type CustomField, type FieldKind } from "@/lib/custom-fields-shared";

const kindLabel = (k: FieldKind) => FIELD_KINDS.find((x) => x.value === k)?.label ?? k;
const splitOptions = (s: string) => s.split(/[\n,]/).map((o) => o.trim()).filter(Boolean);

/** Settings → Custom fields: extra details shown on every person's page. */
export function CustomFieldsSettings({ fields, canManage, orgName }: { fields: CustomField[]; canManage: boolean; orgName: string | null }) {
  const router = useRouter();
  const active = fields.filter((f) => !f.archived);
  const archived = fields.filter((f) => f.archived);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<FieldKind>("text");
  const [options, setOptions] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      after?.();
      router.refresh();
    });
  };

  const small = "rounded-full px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text disabled:opacity-40";

  return (
    <div className="card space-y-4 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-text">Extra details on every person</h3>
        <p className="text-xs text-text-muted">
          Add the things you keep track of that Surfdesk doesn&apos;t ask for, like a pet&apos;s name, a membership level or a renewal date. They show
          under Details on each person&apos;s page and in your exports. Keep it everyday: don&apos;t use these for IDs, health, financial or other
          sensitive information.
          {orgName && !canManage ? ` Only ${orgName}'s admins can change this list.` : ""}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-text-faint">No custom fields yet.</p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border">
          {active.map((f, i) =>
            editing === f.id ? (
              <EditRow key={f.id} field={f} pending={pending} onCancel={() => setEditing(null)} onSave={(l, o) => run(() => updateCustomField(f.id, { label: l, options: o }), () => setEditing(null))} />
            ) : (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text">{f.label}</p>
                  <p className="truncate text-xs text-text-muted">
                    {kindLabel(f.kind)}
                    {f.kind === "choice" ? `: ${f.options.join(", ")}` : ""}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Move up" disabled={pending || i === 0} onClick={() => run(() => moveCustomField(f.id, -1))} className={small}>
                      ↑
                    </button>
                    <button type="button" aria-label="Move down" disabled={pending || i === active.length - 1} onClick={() => run(() => moveCustomField(f.id, 1))} className={small}>
                      ↓
                    </button>
                    <button type="button" disabled={pending} onClick={() => setEditing(f.id)} className={small}>
                      Edit
                    </button>
                    <button type="button" disabled={pending} onClick={() => run(() => setCustomFieldArchived(f.id, true))} className={small}>
                      Retire
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {canManage && active.length < MAX_FIELDS && (
        <form
          className="space-y-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addCustomField({ label, kind, options: splitOptions(options) }),
              () => {
                setLabel("");
                setOptions("");
                setKind("text");
              },
            );
          }}
        >
          <p className="text-xs text-text-muted">Add a field</p>
          <div className="flex flex-wrap gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Name, e.g. Pet's name" className="input min-w-0 flex-1" required />
            <select value={kind} onChange={(e) => setKind(e.target.value as FieldKind)} className="input w-auto" aria-label="Type">
              {FIELD_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-text-faint">{FIELD_KINDS.find((k) => k.value === kind)?.hint}</p>
          {kind === "choice" && (
            <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Options, separated by commas: Bronze, Silver, Gold" className="input" required />
          )}
          <button type="submit" disabled={pending || !label.trim()} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50">
            {pending ? "Adding…" : "Add field"}
          </button>
        </form>
      )}

      {archived.length > 0 && (
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-xs text-text-muted">Retired ({archived.length})</summary>
          <ul className="mt-2 space-y-1">
            {archived.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-text-muted">{f.label}</span>
                {canManage && (
                  <button type="button" disabled={pending} onClick={() => run(() => setCustomFieldArchived(f.id, false))} className={small}>
                    Bring back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EditRow({ field, pending, onSave, onCancel }: { field: CustomField; pending: boolean; onSave: (label: string, options: string[]) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState(field.options.join(", "));
  return (
    <li className="space-y-2 px-3 py-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className="input" aria-label="Field name" />
      {field.kind === "choice" && <input value={options} onChange={(e) => setOptions(e.target.value)} className="input" aria-label="Options" />}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => onSave(label, splitOptions(options))} className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-bg">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-text-muted hover:text-text">
          Cancel
        </button>
      </div>
    </li>
  );
}
