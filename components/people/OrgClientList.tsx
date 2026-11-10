"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fuzzyFilter } from "@/lib/fuzzy";
import { SEARCH_INPUT } from "@/lib/input-props";

export type OrgClientRow = {
  id: string;
  display_name: string;
  owner: string;
  mine: boolean;
  needs_followup: boolean;
  last_activity_at: string;
};

/** People → Everyone at <org> (admins and supervisors): every agency client with their case manager. */
export function OrgClientList({ clients }: { clients: OrgClientRow[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () =>
      fuzzyFilter(clients, query, (c) => [
        { text: c.display_name, weight: 1 },
        { text: c.owner, weight: 0.6 },
      ]),
    [clients, query],
  );
  return (
    <div className="space-y-3">
      <input
        {...SEARCH_INPUT}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${clients.length} clients or case managers…`}
        className="input"
      />
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">No clients match.</p>
      ) : (
        <ul className="card divide-y divide-border-subtle">
          {shown.map((c) => (
            <li key={c.id}>
              <Link
                href={c.mine ? `/people/${c.id}` : `/team/client/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-text">{c.display_name}</span>
                  <span className="block truncate text-xs text-text-muted">Case manager: {c.mine ? "you" : c.owner}</span>
                </span>
                {c.needs_followup && <span className="tag tag-e shrink-0">Follow up</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
