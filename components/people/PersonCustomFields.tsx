"use client";

import { useState, useTransition } from "react";
import { setPersonField } from "@/lib/actions/custom-fields";
import { displayFieldValue, type CustomField } from "@/lib/custom-fields-shared";

/** A person's custom fields (Settings → Custom fields), each saved on its own as soon as it changes. */
export function PersonCustomFields({ personId, fields, values }: { personId: string; fields: CustomField[]; values: Record<string, string> }) {
  return (
    <>
      {fields.map((f) => (
        <FieldRow key={f.id} personId={personId} field={f} initial={values[f.id] ?? ""} />
      ))}
    </>
  );
}

function FieldRow({ personId, field, initial }: { personId: string; field: CustomField; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (next: string) => {
    if (next === saved) return setEditing(false);
    setError(null);
    start(async () => {
      const r = await setPersonField(personId, field.id, next);
      if (!r.ok) return setError(r.error);
      setSaved(r.data.value ?? "");
      setValue(r.data.value ?? "");
      setEditing(false);
    });
  };

  const label = <span className="mb-0.5 block text-[11px] uppercase text-text-faint">{field.label}</span>;
  // Pick-lists and yes/no save on change; text, numbers and dates on leaving the field (or Enter).
  if (field.kind === "choice" || field.kind === "yesno") {
    const opts = field.kind === "yesno" ? [["yes", "Yes"], ["no", "No"]] : field.options.map((o) => [o, o]);
    return (
      <label className="card block px-3 py-2">
        {label}
        <select value={value} disabled={pending} onChange={(e) => (setValue(e.target.value), save(e.target.value))} className="w-full bg-transparent text-sm text-text">
          <option value="">—</option>
          {opts.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {error && <span className="block text-xs text-danger">{error}</span>}
      </label>
    );
  }
  return (
    <div className="card px-3 py-2">
      {label}
      {editing ? (
        <input
          autoFocus
          type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
          inputMode={field.kind === "number" ? "decimal" : undefined}
          value={value}
          maxLength={200}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save(value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save(value);
            if (e.key === "Escape") (setValue(saved), setEditing(false));
          }}
          className="input py-1 text-sm"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="block w-full text-left text-sm text-text hover:text-accent">
          {saved ? displayFieldValue(field.kind, saved) : <span className="text-text-faint">Add {field.label.toLowerCase()}...</span>}
        </button>
      )}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </div>
  );
}
