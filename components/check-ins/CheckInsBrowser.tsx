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

  /** Export uses the same filters as the list on screen. */
  function exportHref(format: string): string {
    const params = new URLSearchParams({ format });
    try {
      params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {}
    if (search.trim()) params.set("q", search.trim());
    // Local calendar days -> instants; `to` is exclusive, so it's the next midnight.
    if (from) params.set("from", new Date(`${from}T00:00`).toISOString());
    if (to) {
      const end = new Date(`${to}T00:00`);
      end.setDate(end.getDate() + 1);
      params.set("to", end.toISOString());
    }
    return `/api/check-ins/export?${params}`;
  }

  return (
    <div className="space-y-6">
      <CheckInForm people={people} reasons={reasons} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-muted">
          <span>
            Today <strong className="tabular-nums text-text">{todayCount}</strong>
          </span>
          <span>
            {filtering ? "Showing" : "All time"}{" "}
            <strong className="tabular-nums text-text">{filtered.length}</strong>
          </span>
          <details className="relative ml-auto">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg-hover [&::-webkit-details-marker]:hidden">
              Export{filtering ? " filtered" : ""} ▾
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded border border-border bg-bg shadow-lg">
              {[
                ["pdf", "PDF"],
                ["xlsx", "Excel (.xlsx)"],
                ["csv", "CSV"],
              ].map(([format, label]) => (
                <a
                  key={format}
                  href={exportHref(format)}
                  download
                  onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
                  className="block px-3 py-2 text-sm text-text hover:bg-bg-hover"
                >
                  {label}
                </a>
              ))}
            </div>
          </details>
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
