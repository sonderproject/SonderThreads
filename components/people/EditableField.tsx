"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePersonSafe } from "@/lib/actions/people";
import { Dictate } from "@/components/voice/Dictate";
import type { Person } from "@/lib/types";

type EditablePersonField = "current_status" | "next_action" | "display_name" | "phone" | "email" | "birthday";

export function EditableField({
  personId,
  field,
  value,
  placeholder,
  textClassName,
  inputType = "text",
  required = false,
  displayValue,
}: {
  personId: string;
  field: EditablePersonField;
  value: string | null;
  placeholder: string;
  textClassName: string;
  inputType?: "text" | "email" | "tel" | "date";
  /** Blank input is discarded instead of saved (e.g. a name can't be cleared). */
  required?: boolean;
  /** What to show instead of the raw value when not editing (e.g. a formatted date). */
  displayValue?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    if (text === (value ?? "") || (required && !text.trim())) {
      setEditing(false);
      setText(value ?? "");
      return;
    }
    setSaving(true);
    setError(null);
    const patch: Partial<Pick<Person, EditablePersonField>> = {
      [field]: text.trim() || null,
    };
    const result = await updatePersonSafe(personId, patch);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (editing) {
    const field = (
      <input
        autoFocus
        type={inputType}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setEditing(false);
            setText(value ?? "");
            setError(null);
          }
        }}
        disabled={saving}
        className="input text-sm"
      />
    );
    return (
      <div className="space-y-1">
        {error && <p className="text-xs text-red-400">{error}</p>}
        {inputType === "text" ? (
          <Dictate value={text} onChange={setText}>
            {field}
          </Dictate>
        ) : (
          field
        )}
      </div>
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      className={`cursor-text ${textClassName}`}
      title="Click to edit"
    >
      {value ? (displayValue ?? value) : placeholder}
    </p>
  );
}
