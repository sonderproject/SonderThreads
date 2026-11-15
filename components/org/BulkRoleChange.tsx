"use client";

import { useMemo, useState } from "react";
import { bulkChangeRole } from "@/lib/actions/team-invites";
import { ORG_ROLES, ROLE_LABELS, type OrgRole } from "@/lib/org-roles";

type Person = { id: string; label: string; role: OrgRole };

/** Admin: pick several members and give them one role in one step (you can't change your own role here). */
export function BulkRoleChange({ people }: { people: Person[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? people.filter((p) => p.label.toLowerCase().includes(f)) : people;
  }, [people, filter]);
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-text">Change several roles at once</summary>
      <form action={bulkChangeRole} className="mt-3 space-y-3">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or email" className="input" aria-label="Filter members" />
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{picked.size} selected</span>
          <span className="flex gap-3">
            <button type="button" className="hover:text-text" onClick={() => setPicked(new Set([...picked, ...shown.map((p) => p.id)]))}>
              Select {filter ? "shown" : "all"}
            </button>
            <button type="button" className="hover:text-text" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </span>
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {shown.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-bg-hover">
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                <span className="min-w-0 flex-1 truncate text-text">{p.label}</span>
                <span className="shrink-0 text-xs text-text-muted">{ROLE_LABELS[p.role]}</span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="p-1 text-xs text-text-muted">No one matches.</li>}
        </ul>
        {[...picked].map((id) => (
          <input key={id} type="hidden" name="user_id" value={id} />
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <select name="role" defaultValue="supervisor" className="input w-auto py-1 text-sm" aria-label="New role">
            {ORG_ROLES.map((r) => (
              <option key={r} value={r}>
                Make them {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={picked.size === 0}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50"
          >
            Change {picked.size} {picked.size === 1 ? "role" : "roles"}
          </button>
        </div>
      </form>
    </details>
  );
}
