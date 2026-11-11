"use client";

import { useTerms } from "@/components/TermsProvider";

import { useCallback, useEffect, useState } from "react";
import { getMetricsSafe } from "@/lib/actions/metrics";
import { addDays, buildStory, daysBetween, type Kpis, type Metrics, type MetricsScope, type Point } from "@/lib/metrics-shared";
import { dayKey } from "@/lib/tz";
import { useTimeZone } from "@/components/TimeZoneProvider";
import { ColumnChart } from "@/components/metrics/ColumnChart";
import { BarList } from "@/components/metrics/BarList";
import { ReachChart } from "./ReachChart";
import { BusiestTimes } from "./BusiestTimes";
import { FollowThroughBar } from "./FollowThroughBar";

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

/** Studio-style chapter marker: number, hairline, label. */
function Chapter({ n, title, lead, children }: { n: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.25em] text-text-muted">
          <span className="tabular-nums text-accent">{n}</span>
          <span className="h-px w-10" style={{ background: "color-mix(in srgb, var(--accent) 45%, transparent)" }} aria-hidden />
          {title}
        </p>
        {lead && <p className="text-sm text-text-muted">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * The Impact page: a report that reads top to bottom. Headline numbers and a
 * written summary, then chapters (reach, engagement, needs, who we serve,
 * follow-through), with a date range, a Me / Organization switch for admins
 * and supervisors, and PDF / Excel / CSV export of exactly what's shown.
 */
export function ImpactDashboard({ orgName }: { orgName: string | null }) {
  const terms = useTerms();
  const timeZone = useTimeZone();
  const [today, setToday] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("30");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [scope, setScope] = useState<MetricsScope>(orgName ? "org" : "me");
  // Follow-ups are optional (tracking them is extra work): off unless turned on, remembered on this device.
  const [followUps, setFollowUps] = useState(false);
  useEffect(() => {
    try {
      setFollowUps(localStorage.getItem("impact-follow-ups") === "1");
    } catch {}
  }, []);
  const toggleFollowUps = () =>
    setFollowUps((on) => {
      try {
        localStorage.setItem("impact-follow-ups", on ? "0" : "1");
      } catch {}
      return !on;
    });
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = dayKey(new Date(), timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setToday(t);
    setCustom({ from: addDays(t, -29), to: t });
  }, [timeZone]);

  const range = today ? rangeFor(preset, today, custom) : null;

  const load = useCallback(async (from: string, to: string, s: MetricsScope) => {
    setLoading(true);
    setError(null);
    const result = await getMetricsSafe(from, to, s);
    setLoading(false);
    if (result.ok) setData(result.data);
    else setError(result.error);
  }, []);

  useEffect(() => {
    if (range?.from && range.to) load(range.from, range.to, scope);
  }, [range?.from, range?.to, scope, load]);

  const periodName = range ? `the previous ${daysBetween(range.from, range.to)} days` : "";
  const exportHref = (format: string) =>
    range
      ? `/api/metrics/export?${new URLSearchParams({ format, from: range.from, to: range.to, scope, ...(followUps ? { followups: "1" } : {}) })}`
      : "#";
  const bucketWord = data?.bucket === "day" ? "day" : data?.bucket === "week" ? "week" : "month";
  const story = data ? buildStory(data, { followUps }).map((line) => line.replace(/check-ins/g, terms.checkInsLower)) : [];

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="eyebrow text-text-muted">{scope === "org" && orgName ? orgName : "Your work"}</p>
          <h1 className="page-title">{terms.impact}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {orgName && (
            <div className="mr-2 inline-flex rounded-full border border-border bg-bg-raised p-0.5" role="group" aria-label="Whose numbers">
              {(["org", "me"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  aria-pressed={scope === s}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${scope === s ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}
                >
                  {s === "org" ? "Organization" : "Just me"}
                </button>
              ))}
            </div>
          )}
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                preset === key
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-bg-raised text-text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={toggleFollowUps}
            aria-pressed={followUps}
            title="Include follow-ups (tasks with due dates) in the report"
            className={`rounded-full border px-2.5 py-1 text-xs ${
              followUps ? "border-accent bg-accent-soft text-accent" : "border-border bg-bg-raised text-text-muted hover:text-text"
            }`}
          >
            Follow-ups {followUps ? "on" : "off"}
          </button>
          <details className="relative ml-auto">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim [&::-webkit-details-marker]:hidden">
              Export report ▾
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-bg-raised shadow-lg">
              {[
                ...(orgName ? [["pdf", "PDF report"]] : []),
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
              {!orgName && (
                <p className="border-t border-border-subtle px-3 py-2 text-xs text-text-muted">
                  PDF reports with your logo come with Organization plans.
                </p>
              )}
            </div>
          </details>
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <label className="flex items-center gap-2">
              From
              <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="input w-auto tabular-nums" />
            </label>
            <label className="flex items-center gap-2">
              To
              <input type="date" value={custom.to} min={custom.from} max={today ?? undefined} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="input w-auto tabular-nums" />
            </label>
          </div>
        )}

        {range && (
          <p className="text-xs text-text-muted">
            {formatDay(range.from)} – {formatDay(range.to)}
            {loading && data && " · updating…"}
          </p>
        )}
        {error && <p className="flag text-sm">Couldn’t load the numbers: {error}</p>}
      </div>

      {!data ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-busy="true">
          {TILES.map((t) => (
            <div key={t.key} className="card h-[5.5rem] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className={`space-y-12 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <section className="card space-y-3 p-5 sm:p-6">
            <p className="section-label">The story</p>
            <div className="space-y-2">
              {story.map((line, i) => (
                <p key={i} className={i === 0 ? "font-display text-xl font-light leading-snug text-text sm:text-2xl" : "text-sm leading-relaxed text-text-muted sm:text-base"}>
                  {line}
                </p>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TILES.map((t) => (
              <StatTile key={t.key} label={t.key === "checkIns" ? terms.checkIns : t.label} hint={t.hint} value={data.kpis[t.key]} prev={data.prev[t.key]} periodName={periodName} />
            ))}
          </div>

          <Chapter n="01" title="Reach" lead="How many people came in, and how many were new.">
            <div className="grid gap-3 lg:grid-cols-2">
              <ChartCard title="People served" subtitle={`Per ${bucketWord}, returning and first visit`} table={data.reach.map((r) => ({ key: r.key, label: r.label, value: r.first + r.returning }))} unit="people" wide>
                <ReachChart data={data.reach} />
              </ChartCard>
              <ChartCard title="New clients added" subtitle={`Per ${bucketWord}`} table={data.newPeopleOverTime} unit="people">
                <ColumnChart data={data.newPeopleOverTime} unit="new clients" />
              </ChartCard>
              <ChartCard title={terms.checkIns} subtitle={`Per ${bucketWord}`} table={data.checkInsOverTime} unit={terms.checkInsLower}>
                <ColumnChart data={data.checkInsOverTime} unit={terms.checkInsLower} />
              </ChartCard>
            </div>
          </Chapter>

          <Chapter n="02" title="When people come" lead="Plan staffing around your busiest hours.">
            <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
              <section className="card space-y-3 p-4">
                <h3 className="text-sm font-semibold text-text">Busiest times</h3>
                <BusiestTimes grid={data.heatmap} />
              </section>
              <ChartCard title="By day of week" subtitle={terms.checkIns} table={data.byWeekday} unit={terms.checkInsLower}>
                <ColumnChart data={data.byWeekday} unit={terms.checkInsLower} height={160} />
              </ChartCard>
            </div>
          </Chapter>

          <Chapter n="03" title="Needs" lead="Why people came in.">
            <ChartCard title="Reasons for visits" subtitle={`${terms.checkIns} by reason`} table={data.byReason} unit={terms.checkInsLower} wide>
              {data.byReason.length ? <BarList data={data.byReason} unit={terms.checkInsLower} /> : <Empty />}
            </ChartCard>
          </Chapter>

          <Chapter n="04" title="Who we serve" lead="People served in this period, each counted once.">
            <div className="grid gap-3 lg:grid-cols-3">
              <ChartCard title="Gender" subtitle="People served" table={data.byGender} unit="people">
                <Demographic data={data.byGender} />
              </ChartCard>
              <ChartCard title="Ethnicity" subtitle="People served" table={data.byEthnicity} unit="people">
                <Demographic data={data.byEthnicity} />
              </ChartCard>
              <ChartCard title="Income level" subtitle="People served" table={data.byIncome} unit="people">
                <Demographic data={data.byIncome} />
              </ChartCard>
            </div>
          </Chapter>

          {followUps && (
            <Chapter n="05" title="Follow-through" lead="Follow-ups (tasks with a due date) that were due in this period.">
              <section className="card p-5">
                <FollowThroughBar data={data.followThrough} />
              </section>
            </Chapter>
          )}

          <Chapter n={followUps ? "06" : "05"} title="Regulars" lead="The people who came in most. Not included in exported reports.">
            {scope === "me" ? (
                <ChartCard title="Most frequent visitors" subtitle={`Top 10 by ${terms.checkInsLower}`} table={data.topVisitors} unit={terms.checkInsLower}>
                  {data.topVisitors.length ? <BarList data={data.topVisitors} unit={terms.checkInsLower} hrefFor={(p) => `/people/${p.personId}`} /> : <Empty />}
                </ChartCard>
              ) : (
                <ChartCard title="Most frequent visitors" subtitle={`Top 10 by ${terms.checkInsLower}`} table={data.topVisitors} unit={terms.checkInsLower}>
                  {data.topVisitors.length ? <BarList data={data.topVisitors} unit={terms.checkInsLower} hrefFor={(p) => `/team/client/${p.personId}`} /> : <Empty />}
                </ChartCard>
              )}
          </Chapter>
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
