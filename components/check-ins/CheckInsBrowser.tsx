"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckInForm } from "./CheckInForm";
import { CheckInRow } from "./CheckInRow";
import { formatCheckInDay, localDayKey } from "./time";
import type { CheckInWithPerson, Person } from "@/lib/types";

export function CheckInsBrowser({
  checkIns,
  people,
  reasons,
}: {
  checkIns: CheckInWithPerson[];
  people: Pick<Person, "id" | "display_name">[];
  reasons: string[];
}) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return checkIns.filter((c) => {
      const day = localDayKey(c.checked_in_at);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return c.display_name.toLowerCase().includes(q) || (c.reason ?? "").toLowerCase().includes(q);
    });
  }, [checkIns, search, from, to]);

  const days = useMemo(() => {
    const groups: { key: string; label: string; items: CheckInWithPerson[] }[] = [];
    for (const c of filtered) {
      const key = localDayKey(c.checked_in_at);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(c);
      else groups.push({ key, label: formatCheckInDay(c.checked_in_at), items: [c] });
    }
    return groups;
  }, [filtered]);

  const todayKey = localDayKey(new Date());
  const todayCount = checkIns.filter((c) => localDayKey(c.checked_in_at) === todayKey).length;
  const filtering = Boolean(search.trim() || from || to);

  return (
    <div className="space-y-6">
      <CheckInForm people={people} reasons={reasons} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-text-muted">
          <span>
            Today <strong className="tabular-nums text-text">{todayCount}</strong>
          </span>
          <span>
            {filtering ? "Showing" : "All time"}{" "}
            <strong className="tabular-nums text-text">{filtered.length}</strong>
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or reason..."
            className="input"
          />
          <label className="flex items-center gap-2 text-xs text-text-faint">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input tabular-nums" />
          </label>
          <label className="flex items-center gap-2 text-xs text-text-faint">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input tabular-nums" />
          </label>
        </div>
        {filtering && (
          <button
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        )}

        {days.length === 0 ? (
          <EmptyState message={checkIns.length === 0 ? "No check-ins yet." : "No matches."} />
        ) : (
          days.map((day) => (
            <div key={day.key} className="space-y-1.5">
              <h2 className="eyebrow text-text-faint">
                {day.key === todayKey ? "Today" : day.label}{" "}
                <span className="tabular-nums">· {day.items.length}</span>
              </h2>
              <div className="divide-y divide-border-subtle rounded border border-border bg-bg-raised">
                {day.items.map((c) => (
                  <CheckInRow key={c.id} checkIn={c} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
