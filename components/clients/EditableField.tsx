"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateClientSafe } from "@/lib/actions/clients";
import type { Client } from "@/lib/types";

export function EditableField({
  clientId,
  field,
  value,
  placeholder,
  textClassName,
}: {
  clientId: string;
  field: "current_status" | "next_action";
  value: string | null;
  placeholder: string;
  textClassName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    if (text === (value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const patch: Partial<Pick<Client, "current_status" | "next_action">> = {
      [field]: text.trim() || null,
    };
    const result = await updateClientSafe(clientId, patch);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <input
          autoFocus
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
      </div>
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      className={`cursor-text ${textClassName}`}
      title="Click to edit"
    >
      {value || placeholder}
    </p>
  );
}
