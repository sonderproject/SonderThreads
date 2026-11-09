"use client";

import { useState } from "react";

/** Checkbox list of private clients with Select all / Clear, for /organization/clients. */
export function ClientPicker({ people }: { people: { id: string; display_name: string }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const all = selected.size === people.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text">Your private clients</p>
        <button
          type="button"
          onClick={() => setSelected(all ? new Set() : new Set(people.map((p) => p.id)))}
          className="text-sm text-accent hover:underline"
        >
          {all ? "Clear all" : `Select all (${people.length})`}
        </button>
      </div>
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
        {people.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-2 py-1 text-sm text-text">
              <input type="checkbox" name="person_id" value={p.id} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              {p.display_name}
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">{selected.size} selected</p>
    </div>
  );
}
