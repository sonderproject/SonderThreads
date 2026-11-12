"use client";

import type { Service } from "@/lib/services";
import { useTerms } from "@/components/TermsProvider";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckInForm } from "./CheckInForm";
import { CheckInRow } from "./CheckInRow";
import { formatCheckInDay, localDayKey } from "./time";
import { DEFAULT_RANGE_DAYS, addDays } from "./range";
import type { CheckInWithPerson, Person } from "@/lib/types";
import { SEARCH_INPUT } from "@/lib/input-props";
import { fuzzyMatcher } from "@/lib/fuzzy";

const PRESETS: [label: string, days: number][] = [
  ["Today", 1],
  ["7 days", 7],
  ["30 days", 30],
  ["60 days", 60],
  ["90 days", 90],
];

function formatDayKey(day: string, weekday = true): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: weekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CheckInsBrowser({
  checkIns,
  people,
  reasons,
  services = [],
  canAddService = false,
  range,
  hasParams,
}: {
  services?: Service[];
  canAddService?: boolean;
  checkIns: CheckInWithPerson[];
  people: Pick<Person, "id" | "display_name">[];
  reasons: string[];
  /** Days shown (local YYYY-MM-DD, inclusive), or null for all time. */
  range: { from: string; to: string } | null;
  /** False on a bare /check-ins visit: use the browser's own "today". */
  hasParams: boolean;
}) {
  const terms = useTerms();
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  const [search, setSearch] = useState("");
  const todayKey = localDayKey(new Date());
  // The server only knows UTC; on a bare visit, anchor the default range to the local day.
  const from = range ? (hasParams ? range.from : addDays(todayKey, -(DEFAULT_RANGE_DAYS - 1))) : "";
  const to = range ? (hasParams ? range.to : todayKey) : "";

  function go(next: { from: string; to: string } | "all") {
    const params = next === "all" ? "all=1" : new URLSearchParams(next).toString();
    startLoading(() => router.replace(`/check-ins?${params}`, { scroll: false }));
  }
  function lastDays(n: number) {
    go({ from: addDays(todayKey, -(n - 1)), to: todayKey });
  }
  const singleDay = range !== null && from === to;
  const activePreset = range !== null && to === todayKey ? PRESETS.find(([, n]) => addDays(todayKey, -(n - 1)) === from)?.[1] : undefined;

  const filtered = useMemo(() => {
    // Typo-tolerant, but kept in date order (the list is grouped by day).
    const matches = fuzzyMatcher(search);
    return checkIns.filter((c) => {
      const day = localDayKey(c.checked_in_at);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return matches([{ text: c.display_name, weight: 1 }, { text: c.reason, weight: 1 }]) > 0;
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

  const todayCount = checkIns.filter((c) => localDayKey(c.checked_in_at) === todayKey).length;
  const showsToday = range === null || (from <= todayKey && todayKey <= to);
  const rangeLabel =
    range === null ? "All time" : singleDay ? formatDayKey(from) : `${formatDayKey(from, false)} – ${formatDayKey(to, false)}`;

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
      <CheckInForm people={people} reasons={reasons} services={services} canAddService={canAddService} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-muted">
          {showsToday && (
            <span>
              Today <strong className="tabular-nums text-text">{todayCount}</strong>
            </span>
          )}
          <span>
            Showing <strong className="tabular-nums text-text">{filtered.length}</strong>
          </span>
          <details className="relative ml-auto">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg-hover [&::-webkit-details-marker]:hidden">
              Export ▾
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded border border-border bg-bg-raised shadow-lg">
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

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([label, n]) => (
            <button
              key={n}
              type="button"
              onClick={() => lastDays(n)}
              className={chipClass(activePreset === n)}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={() => go("all")} className={chipClass(range === null)}>
            All time
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
          <label className="flex items-center gap-2 text-xs text-text-faint">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => e.target.value && go({ from: e.target.value, to: to && to >= e.target.value ? to : e.target.value })}
              className="input tabular-nums"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-text-faint">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => e.target.value && go({ from: from && from <= e.target.value ? from : e.target.value, to: e.target.value })}
              className="input tabular-nums"
            />
          </label>
          <input
            {...SEARCH_INPUT}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or reason..."
            className="input"
          />
        </div>

        <div className="flex items-center gap-2">
          {singleDay && (
            <button
              type="button"
              onClick={() => go({ from: addDays(from, -1), to: addDays(from, -1) })}
              aria-label="Previous day"
              className="flex h-9 w-9 items-center justify-center rounded border border-border text-text hover:border-accent hover:text-accent"
            >
              ‹
            </button>
          )}
          <h2 className="section-title flex-1 text-balance">
            {rangeLabel}
            {loading && <span className="ml-2 text-sm font-normal text-text-faint">Loading…</span>}
          </h2>
          {singleDay && (
            <button
              type="button"
              onClick={() => go({ from: addDays(from, 1), to: addDays(from, 1) })}
              disabled={from >= todayKey}
              aria-label="Next day"
              className="flex h-9 w-9 items-center justify-center rounded border border-border text-text hover:border-accent hover:text-accent disabled:opacity-40"
            >
              ›
            </button>
          )}
        </div>

        {days.length === 0 ? (
          <EmptyState message={search.trim() ? "No matches." : `No ${terms.checkInsLower} in this range.`} />
        ) : (
          days.map((day) => (
            <div key={day.key} className="space-y-1.5">
              <h3 className="eyebrow flex items-center gap-2 text-text-faint">
                {day.key === todayKey ? "Today" : day.label}{" "}
                <span className="tabular-nums">· {day.items.length}</span>
                {!singleDay && (
                  <button
                    type="button"
                    onClick={() => go({ from: day.key, to: day.key })}
                    className="ml-auto normal-case tracking-normal text-accent hover:underline"
                  >
                    View day
                  </button>
                )}
              </h3>
              <div className="divide-y divide-border-subtle card">
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

function chipClass(active: boolean): string {
  return `rounded-full border px-2.5 py-1 text-xs ${
    active ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted hover:border-accent hover:text-accent"
  }`;
}
