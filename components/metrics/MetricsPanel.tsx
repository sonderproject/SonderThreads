"use client";

import { useCallback, useEffect, useState } from "react";
import { getMetricsSafe } from "@/lib/actions/metrics";
import { addDays, daysBetween, type Kpis, type Metrics, type Point } from "@/lib/metrics-shared";
import { dayKey } from "@/lib/tz";
import { useTimeZone } from "@/components/TimeZoneProvider";
import { ColumnChart } from "./ColumnChart";
import { BarList } from "./BarList";

type Preset = "7" | "30" | "90" | "year" | "custom";

const PRESETS: [Preset, string][] = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["year", "This year"],
  ["custom", "Custom"],
];

const TILES: { key: keyof Kpis; label: string; hint?: string }[] = [
  { key: "peopleServed", label: "People served", hint: "Each person counted once" },
  { key: "checkIns", label: "Check-ins" },
  { key: "newPeople", label: "New people" },
  { key: "notes", label: "Notes written" },
  { key: "tasksDone", label: "Tasks completed" },
];

function rangeFor(preset: Preset, today: string, custom: { from: string; to: string }) {
  if (preset === "custom") return custom;
  if (preset === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: addDays(today, -(Number(preset) - 1)), to: today };
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * Command-page metrics: headline numbers with change vs the previous period,
 * charts, and exports. Loads after the page so Command stays fast.
 */
export function MetricsPanel() {
  const timeZone = useTimeZone();
  const [today, setToday] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("30");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = dayKey(new Date(), timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setToday(t);
    setCustom({ from: addDays(t, -29), to: t });
  }, [timeZone]);

  const range = today ? rangeFor(preset, today, custom) : null;

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    const result = await getMetricsSafe(from, to);
    setLoading(false);
    if (result.ok) setData(result.data);
    else setError(result.error);
  }, []);

  useEffect(() => {
    if (range?.from && range.to) load(range.from, range.to);
  }, [range?.from, range?.to, load]);

  const periodName = range ? `the previous ${daysBetween(range.from, range.to)} days` : "";
  const exportHref = (format: string) =>
    range ? `/api/metrics/export?${new URLSearchParams({ format, from: range.from, to: range.to })}` : "#";
  const bucketWord = data?.bucket === "day" ? "day" : data?.bucket === "week" ? "week" : "month";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            className={`rounded border px-2.5 py-1 text-xs ${
              preset === key
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-bg-raised text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {label}
          </button>
        ))}
        <details className="relative ml-auto">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded border border-border bg-bg-raised px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg-hover [&::-webkit-details-marker]:hidden">
            Export ▾
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded border border-border bg-bg-raised shadow-lg">
            {[
              ["pdf", "PDF report"],
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

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <label className="flex items-center gap-2">
            From
            <input
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
              className="input w-auto tabular-nums"
            />
          </label>
          <label className="flex items-center gap-2">
            To
            <input
              type="date"
              value={custom.to}
              min={custom.from}
              max={today ?? undefined}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              className="input w-auto tabular-nums"
            />
          </label>
        </div>
      )}

      {range && (
        <p className="text-xs text-text-muted">
          {formatDay(range.from)} – {formatDay(range.to)}
          {loading && data && " · updating…"}
        </p>
      )}

      {error && <p className="flag text-sm">Couldn’t load metrics: {error}</p>}

      {!data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-busy="true">
          {TILES.map((t) => (
            <div key={t.key} className="card h-[5.5rem] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TILES.map((t) => (
              <StatTile key={t.key} label={t.label} hint={t.hint} value={data.kpis[t.key]} prev={data.prev[t.key]} periodName={periodName} />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Check-ins" subtitle={`Per ${bucketWord}`} table={data.checkInsOverTime} unit="check-ins">
              <ColumnChart data={data.checkInsOverTime} unit="check-ins" />
            </ChartCard>
            <ChartCard title="New people" subtitle={`Added per ${bucketWord}`} table={data.newPeopleOverTime} unit="people">
              <ColumnChart data={data.newPeopleOverTime} unit="new people" />
            </ChartCard>
            <ChartCard title="Busiest days" subtitle="Check-ins by day of week" table={data.byWeekday} unit="check-ins">
              <ColumnChart data={data.byWeekday} unit="check-ins" height={160} />
            </ChartCard>
            <ChartCard title="Reasons" subtitle="Why people checked in" table={data.byReason} unit="check-ins">
              {data.byReason.length ? <BarList data={data.byReason} unit="check-ins" /> : <Empty />}
            </ChartCard>
            <ChartCard title="Gender" subtitle="People served, each counted once" table={data.byGender} unit="people" wide>
              <Demographic data={data.byGender} />
            </ChartCard>
            <ChartCard title="Ethnicity" subtitle="People served, each counted once" table={data.byEthnicity} unit="people">
              <Demographic data={data.byEthnicity} />
            </ChartCard>
            <ChartCard title="Income level" subtitle="People served, each counted once" table={data.byIncome} unit="people">
              <Demographic data={data.byIncome} />
            </ChartCard>
            <ChartCard title="Most frequent visitors" subtitle="Top 10 by check-ins" table={data.topVisitors} unit="check-ins" wide>
              {data.topVisitors.length ? (
                <BarList data={data.topVisitors} unit="check-ins" hrefFor={(p) => `/people/${p.personId}`} />
              ) : (
                <Empty />
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, hint, value, prev, periodName }: { label: string; hint?: string; value: number; prev: number; periodName: string }) {
  const change = prev === 0 ? (value > 0 ? null : 0) : Math.round(((value - prev) / prev) * 100);
  return (
    <div className="card px-3 py-2.5" title={hint}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold leading-tight tabular-nums text-text">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] text-text-muted" title={`vs ${periodName} (${prev.toLocaleString()})`}>
        {change === null ? (
          <span className="font-semibold text-accent">▲ new</span>
        ) : change === 0 ? (
          <span>no change</span>
        ) : (
          <span className={`font-semibold ${change > 0 ? "text-accent" : "text-urgent"}`}>
            {change > 0 ? "▲" : "▼"} {Math.abs(change)}%
          </span>
        )}{" "}
        <span className="hidden sm:inline">vs before</span>
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  table,
  unit,
  wide,
  children,
}: {
  title: string;
  subtitle: string;
  table: Point[];
  unit: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const total = table.reduce((s, p) => s + p.value, 0);
  return (
    <section className={`card space-y-3 p-4 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
        <span className="tabular-nums text-xs text-text-muted">
          {total.toLocaleString()} {unit}
        </span>
      </div>
      {children}
      <details className="text-xs">
        <summary className="cursor-pointer text-text-muted hover:text-accent">View as table</summary>
        <table className="mt-2 w-full tabular-nums">
          <tbody className="divide-y divide-border-subtle">
            {table.map((p) => (
              <tr key={p.key}>
                <td className="py-1 text-text">{p.label}</td>
                <td className="py-1 text-right text-text-muted">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-text-muted">No one checked in during this period.</p>;
}

/** Demographic breakdown: only categories with people (the table view and exports list all, zeros included). */
function Demographic({ data }: { data: Point[] }) {
  const shown = data.filter((d) => d.value > 0);
  return shown.length ? <BarList data={shown} unit="people" /> : <Empty />;
}
