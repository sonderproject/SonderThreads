"use client";

import { formatMoney } from "@/lib/money";
import type { ExitStat, MonthRow, OutcomeStat, ServiceStat } from "@/lib/metrics-shared";
import { EXIT_KINDS, exitKindLabel, kindShares, type ExitKind } from "@/lib/exit-kinds";
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

type Preset = "7" | "30" | "90" | "365" | "year" | "lastyear" | "all" | "month" | "custom";

const PRESETS: [Preset, string][] = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["365", "12 months"],
  ["year", "This year"],
  ["lastyear", "Last year"],
  ["all", "All time"],
  ["month", "Pick a month"],
  ["custom", "Custom"],
];

const TILES: { key: keyof Kpis; label: string; hint?: string }[] = [
  { key: "peopleServed", label: "People served", hint: "Each person counted once" },
  { key: "checkIns", label: "Check-ins" },
  { key: "newPeople", label: "New people" },
  { key: "notes", label: "Notes written" },
  { key: "tasksDone", label: "Tasks completed" },
];

function rangeFor(preset: Preset, today: string, custom: { from: string; to: string }, month: string) {
  if (preset === "custom") return custom;
  if (preset === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (preset === "lastyear") {
    const y = Number(today.slice(0, 4)) - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  // Everything kept (reports go back up to 5 years at a time).
  if (preset === "all") return { from: addDays(today, -1829), to: today };
  if (preset === "month") {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const end = `${month}-${String(last).padStart(2, "0")}`;
    return { from: `${month}-01`, to: end > today ? today : end };
  }
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
  const [month, setMonth] = useState("");
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
    setMonth(t.slice(0, 7));
  }, [timeZone]);

  const range = today && month ? rangeFor(preset, today, custom, month) : null;

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
  const showChange = preset !== "all";
  const exportHref = (format: string) =>
    range
      ? `/api/metrics/export?${new URLSearchParams({ format, from: range.from, to: range.to, scope, ...(followUps ? { followups: "1" } : {}) })}`
      : "#";
  const bucketWord = data?.bucket === "day" ? "day" : data?.bucket === "week" ? "week" : "month";
  const story = data ? buildStory(data, { followUps, audience: terms.audience }).map((line) => line.replace(/check-ins/g, terms.checkInsLower)) : [];

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

        {preset === "month" && (
          <label className="flex items-center gap-2 text-xs text-text-muted">
            Month
            <input type="month" value={month} max={today?.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="input w-auto tabular-nums" />
          </label>
        )}

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

          <Totals data={data} checkInsWord={terms.checkIns} showChange={showChange} periodName={periodName} business={terms.audience === "business"} followUps={followUps} />

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

          <Chapter n="02" title="Outcomes and exits" lead="Results people reached, and where people went when they left.">
            <OutcomesSummary data={data} periodName={periodName} />
            <ExitsSummary data={data} periodName={periodName} />
          </Chapter>

          <Chapter n="03" title="When people come" lead="Plan staffing around your busiest hours.">
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

          <Chapter n="04" title="Needs" lead="Why people came in.">
            {data.services.length > 0 && <ServicesTable services={data.services} range={range} />}
            <ChartCard title="Reasons for visits" subtitle={`${terms.checkIns} by reason`} table={data.byReason} unit={terms.checkInsLower} wide>
              {data.byReason.length ? <BarList data={data.byReason} unit={terms.checkInsLower} /> : <Empty />}
            </ChartCard>
          </Chapter>

          <Chapter n="05" title="Who we serve" lead="People served in this period, each counted once.">
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
            <Chapter n="06" title="Follow-through" lead="Follow-ups (tasks with a due date) that were due in this period.">
              <section className="card p-5">
                <FollowThroughBar data={data.followThrough} />
              </section>
            </Chapter>
          )}

          {data.monthly.length > 1 && (
            <Chapter n={followUps ? "07" : "06"} title="Month by month" lead="Totals for each month in this period.">
              <MonthlyTable rows={data.monthly} checkInsWord={terms.checkIns} showValue={data.monthly.some((r) => r.valueCents > 0)} />
            </Chapter>
          )}

          <Chapter n={followUps ? (data.monthly.length > 1 ? "08" : "07") : data.monthly.length > 1 ? "07" : "06"} title="Regulars" lead="The people who came in most. Not included in exported reports.">
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
  const change = prev === 0 ? 0 : Math.round(((value - prev) / prev) * 100);
  return (
    <div className="card px-3 py-2.5" title={hint}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold leading-tight tabular-nums text-text">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] text-text-muted" title={`vs ${periodName} (${prev.toLocaleString()})`}>
        {prev === 0 ? (
          <span>no earlier data</span>
        ) : change === 0 ? (
          <span>no change</span>
        ) : (
          <span className={`font-semibold ${change > 0 ? "text-accent" : "text-urgent"}`}>
            {change > 0 ? "▲" : "▼"} {Math.abs(change)}%
          </span>
        )}
        {prev !== 0 && <span className="hidden sm:inline"> vs before</span>}
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

/** Outcomes: how many people reached any outcome, then each one with its trend. */
export function OutcomesSummary({ data, periodName }: { data: Metrics; periodName: string }) {
  if (data.outcomes.length === 0) {
    return (
      <section className="card space-y-1 p-4 text-sm">
        <p className="text-text">No outcomes recorded in this period.</p>
        <p className="text-xs text-text-muted">
          When someone gets a job, finds housing or becomes a regular, record it on their profile (Outcomes). Your list is in{" "}
          <a href="/settings/outcomes" className="text-accent hover:underline">
            Settings → Outcomes
          </a>
          .
        </p>
      </section>
    );
  }
  const trend = (now: number, prev: number) => {
    if (prev === 0) return now > 0 ? { text: "new", tone: "text-accent" } : { text: "–", tone: "text-text-muted" };
    const pct = Math.round(((now - prev) / prev) * 100);
    if (pct === 0) return { text: "same", tone: "text-text-muted" };
    return { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`, tone: pct > 0 ? "text-accent" : "text-urgent" };
  };
  const total = trend(data.outcomePeople, data.prevOutcomePeople);
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
      <section className="card space-y-1 p-4" style={{ borderColor: "var(--accent)" }}>
        <p className="eyebrow text-text-faint">People who reached an outcome</p>
        <p className="font-display text-4xl font-light tabular-nums">{data.outcomePeople.toLocaleString("en-US")}</p>
        <p className="text-xs text-text-muted">
          <span className={total.tone}>{total.text}</span> vs {periodName} ({data.prevOutcomePeople.toLocaleString("en-US")})
        </p>
      </section>
      <OutcomesTable outcomes={data.outcomes} />
    </div>
  );
}

/** Positive, neutral, unplanned: each group's mark color. Text never uses these. */
const EXIT_FILL: Record<ExitKind, string> = { positive: "var(--chart-1)", neutral: "var(--chart-3)", unplanned: "var(--chart-2)" };

/** Exits: how many left, the split by group as one stacked bar, then each reason. */
export function ExitsSummary({ data, periodName }: { data: Metrics; periodName: string }) {
  const k = data.exitKinds;
  const total = k.positive + k.neutral + k.unplanned;
  const prevTotal = data.prevExitKinds.positive + data.prevExitKinds.neutral + data.prevExitKinds.unplanned;
  if (total === 0 && prevTotal === 0) {
    return (
      <section className="card mt-3 space-y-1 p-4 text-sm">
        <p className="text-text">No exits recorded in this period.</p>
        <p className="text-xs text-text-muted">
          When someone leaves, use the exit button on their profile and pick a reason. Your reasons are in{" "}
          <a href="/settings/outcomes" className="text-accent hover:underline">
            Settings → Outcomes &amp; exits
          </a>
          .
        </p>
      </section>
    );
  }
  const shares = kindShares(k);
  const shown = EXIT_KINDS.filter((x) => k[x.kind] > 0);
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_2fr]">
      <section className="card space-y-3 p-4">
        <div className="space-y-1">
          <p className="eyebrow text-text-faint">Exits</p>
          <p className="font-display text-4xl font-light tabular-nums">{total.toLocaleString("en-US")}</p>
          <p className="text-xs text-text-muted">
            vs {periodName} ({prevTotal.toLocaleString("en-US")})
          </p>
        </div>
        {total > 0 && (
          <>
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={shown.map((x) => `${x.label} ${shares[x.kind]}%`).join(", ")}>
              {shown.map((x) => (
                <span key={x.kind} style={{ width: `${(k[x.kind] / total) * 100}%`, background: EXIT_FILL[x.kind] }} title={`${x.label}: ${k[x.kind]}`} />
              ))}
            </div>
            <ul className="space-y-1 text-sm">
              {EXIT_KINDS.map((x) => (
                <li key={x.kind} className="flex items-center gap-2" title={x.hint}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: EXIT_FILL[x.kind] }} aria-hidden />
                  <span className="flex-1 text-text">{x.label}</span>
                  <span className="tabular-nums font-semibold text-text">{shares[x.kind]}%</span>
                  <span className="w-10 text-right tabular-nums text-text-muted">{k[x.kind]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <ExitsTable exits={data.exits} />
    </div>
  );
}

function ExitsTable({ exits }: { exits: ExitStat[] }) {
  return (
    <section className="card space-y-2 p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="eyebrow text-left">
              <th className="py-1.5 pr-3 font-medium">Exited to</th>
              <th className="py-1.5 pr-3 font-medium">Group</th>
              <th className="py-1.5 pr-3 text-right font-medium">Exits</th>
              <th className="py-1.5 text-right font-medium">Previous period</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {exits.map((e) => (
              <tr key={`${e.name}-${e.kind}`}>
                <td className="py-2 pr-3 text-text">{e.name}</td>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span className="h-2 w-2 rounded-sm" style={{ background: EXIT_FILL[e.kind] }} aria-hidden />
                    {exitKindLabel(e.kind)}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{e.count.toLocaleString("en-US")}</td>
                <td className="py-2 text-right tabular-nums text-text-muted">{e.prevCount.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OutcomesTable({ outcomes }: { outcomes: OutcomeStat[] }) {
  return (
    <section className="card space-y-2 p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="eyebrow text-left">
              <th className="py-1.5 pr-3 font-medium">Outcome</th>
              <th className="py-1.5 pr-3 text-right font-medium">People</th>
              <th className="py-1.5 text-right font-medium">Previous period</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {outcomes.map((o) => (
              <tr key={o.name}>
                <td className="py-2 pr-3 text-text">{o.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{o.people.toLocaleString("en-US")}</td>
                <td className="py-2 text-right tabular-nums text-text-muted">{o.prevPeople.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Services: how often each was provided, to how many people, what it brought in, its trend and its busiest time. */
export function ServicesTable({ services, range }: { services: ServiceStat[]; range?: { from: string; to: string } | null }) {
  const showValue = services.some((s) => s.valueCents > 0);
  const trend = (s: ServiceStat) => {
    if (s.prevCount === 0) return { text: "new", tone: "text-accent" };
    const pct = Math.round(((s.count - s.prevCount) / s.prevCount) * 100);
    if (pct === 0) return { text: "same", tone: "text-text-muted" };
    return { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`, tone: pct > 0 ? "text-accent" : "text-urgent" };
  };
  return (
    <section className="card space-y-2 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Services</h3>
        <p className="text-xs text-text-muted">Most used first. Trend compares with the previous period of the same length.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="eyebrow text-left">
              <th className="py-1.5 pr-3 font-medium">Service</th>
              <th className="py-1.5 pr-3 text-right font-medium">Times</th>
              <th className="py-1.5 pr-3 text-right font-medium">People</th>
              {showValue && <th className="py-1.5 pr-3 text-right font-medium">Value</th>}
              <th className="py-1.5 pr-3 text-right font-medium">Trend</th>
              <th className="py-1.5 font-medium">Busiest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {services.map((s) => {
              const t = trend(s);
              return (
                <tr key={s.name}>
                  <td className="py-2 pr-3 text-text">
                    {/* Who got it, with dates (and save them as a list or group). */}
                    <a href={`/services/${s.id}${range ? `?${new URLSearchParams({ from: range.from, to: range.to })}` : ""}`} className="text-accent hover:underline">
                      {s.name}
                    </a>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{s.count.toLocaleString("en-US")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{s.people.toLocaleString("en-US")}</td>
                  {showValue && <td className="py-2 pr-3 text-right tabular-nums">{s.valueCents ? formatMoney(s.valueCents) : "–"}</td>}
                  <td className={`py-2 pr-3 text-right tabular-nums ${t.tone}`}>{t.text}</td>
                  <td className="py-2 text-text-muted">
                    {s.busiestDay ? `${s.busiestDay.slice(0, 3)}${s.busiestTime ? `, ${s.busiestTime}m` : ""}` : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {showValue && (
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-2 pr-3">Total</td>
                <td className="pt-2 pr-3 text-right tabular-nums">{services.reduce((n, s) => n + s.count, 0).toLocaleString("en-US")}</td>
                <td />
                <td className="pt-2 pr-3 text-right tabular-nums">{formatMoney(services.reduce((n, s) => n + s.valueCents, 0))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function Delta({ value, prev, periodName }: { value: number; prev: number; periodName: string }) {
  const change = prev === 0 ? 0 : Math.round(((value - prev) / prev) * 100);
  return (
    <p className="mt-0.5 text-[11px] text-text-muted" title={`vs ${periodName}`}>
      {prev === 0 && value === 0 ? (
        <span>none yet</span>
      ) : prev === 0 ? (
        <span>new this period</span>
      ) : change === 0 ? (
        <span>same as before ({prev.toLocaleString()})</span>
      ) : (
        <>
          <span className={`font-semibold ${change > 0 ? "text-accent" : "text-urgent"}`}>
            {change > 0 ? "▲" : "▼"} {Math.abs(change)}%
          </span>{" "}
          vs {prev.toLocaleString()} before
        </>
      )}
    </p>
  );
}

function Total({ label, value, display, prev, hint, showChange, periodName }: { label: string; value: number; display?: string; prev?: number; hint?: string; showChange: boolean; periodName: string }) {
  return (
    <div className="card px-3 py-2.5" title={hint}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold leading-tight tabular-nums text-text">{display ?? value.toLocaleString()}</p>
      {showChange && prev !== undefined ? <Delta value={value} prev={prev} periodName={periodName} /> : hint ? <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p> : null}
    </div>
  );
}

/** The headline numbers: activity, then results, then everything since recording started. */
function Totals({ data, checkInsWord, showChange, periodName, business, followUps }: { data: Metrics; checkInsWord: string; showChange: boolean; periodName: string; business: boolean; followUps: boolean }) {
  const k = data.kpis;
  const p = data.prev;
  const firsts = data.reach.reduce((n, r) => n + r.first, 0);
  const returning = Math.max(0, k.peopleServed - firsts);
  const avg = k.peopleServed ? k.checkIns / k.peopleServed : 0;
  const prevAvg = p.peopleServed ? p.checkIns / p.peopleServed : 0;
  const f = data.followThrough;
  const followRate = f.due ? Math.round(((f.onTime + f.late) / f.due) * 100) : null;
  const t = { showChange, periodName };
  const a = data.allTime;
  return (
    <section className="space-y-3">
      <p className="section-label">Totals</p>
      <div className="space-y-2">
        <p className="eyebrow text-text-faint">Activity</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Total label="People served" value={k.peopleServed} prev={p.peopleServed} hint="Each person counted once" {...t} />
          <Total label={checkInsWord} value={k.checkIns} prev={p.checkIns} {...t} />
          <Total label="New people" value={k.newPeople} prev={p.newPeople} {...t} />
          <Total label="Returning people" value={returning} hint="Served this period, not on their first visit" {...t} showChange={false} />
          <Total label="Visits per person" value={avg} display={avg ? avg.toFixed(1) : "0"} prev={undefined} hint={prevAvg ? `${prevAvg.toFixed(1)} before` : "Average"} {...t} showChange={false} />
          <Total label="Notes written" value={k.notes} prev={p.notes} {...t} />
          <Total label="Tasks completed" value={k.tasksDone} prev={p.tasksDone} {...t} />
          {followUps && followRate !== null && <Total label="Follow-ups done" value={followRate} display={`${followRate}%`} hint={`${f.onTime + f.late} of ${f.due} due`} {...t} showChange={false} />}
        </div>
        <p className="eyebrow pt-2 text-text-faint">Results</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Total label="Reached an outcome" value={data.outcomePeople} prev={data.prevOutcomePeople} hint="People, each counted once" {...t} />
          <Total label="Services provided" value={data.extra.servicesProvided} prev={data.prevExtra.servicesProvided} {...t} />
          <Total
            label={business ? "Revenue" : "Value of services"}
            value={data.extra.valueCents}
            display={formatMoney(data.extra.valueCents)}
            prev={data.prevExtra.valueCents}
            hint="From the prices in Settings → Services"
            {...t}
          />
          {data.extra.referrals !== null ? (
            <Total label="Referrals received" value={data.extra.referrals} prev={data.prevExtra.referrals ?? 0} {...t} />
          ) : (
            <Total label="Online bookings" value={data.extra.bookings} prev={data.prevExtra.bookings} {...t} />
          )}
          {data.extra.referrals !== null && <Total label="Online bookings" value={data.extra.bookings} prev={data.prevExtra.bookings} {...t} />}
        </div>
      </div>
      {a.checkIns > 0 && (
        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text">All time</span>
          {a.since ? ` (since ${formatDay(a.since)})` : ""}: {a.people.toLocaleString()} people served · {a.checkIns.toLocaleString()} {checkInsWord.toLowerCase()} ·{" "}
          {a.outcomes.toLocaleString()} outcomes{a.valueCents > 0 ? ` · ${formatMoney(a.valueCents)} in services` : ""}
        </p>
      )}
    </section>
  );
}

/** One row per month in the period, with a totals row. */
function MonthlyTable({ rows, checkInsWord, showValue }: { rows: MonthRow[]; checkInsWord: string; showValue: boolean }) {
  const sum = (k: keyof Omit<MonthRow, "key" | "label">) => rows.reduce((n, r) => n + (r[k] as number), 0);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="eyebrow border-b border-border text-left text-text-faint">
            <th className="px-4 py-2 font-semibold">Month</th>
            <th className="px-3 py-2 text-right font-semibold">People served</th>
            <th className="px-3 py-2 text-right font-semibold">{checkInsWord}</th>
            <th className="px-3 py-2 text-right font-semibold">New people</th>
            <th className="px-3 py-2 text-right font-semibold">Outcomes</th>
            {showValue && <th className="px-4 py-2 text-right font-semibold">Value</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="px-4 py-2 text-text">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.peopleServed.toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.checkIns.toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.newPeople.toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.outcomes.toLocaleString()}</td>
              {showValue && <td className="px-4 py-2 text-right tabular-nums">{formatMoney(r.valueCents)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-semibold text-text">
            <td className="px-4 py-2">Total</td>
            <td className="px-3 py-2 text-right tabular-nums" title="People served counts each person once per month, so the total can be higher than the period's People served">
              {sum("peopleServed").toLocaleString()}*
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{sum("checkIns").toLocaleString()}</td>
            <td className="px-3 py-2 text-right tabular-nums">{sum("newPeople").toLocaleString()}</td>
            <td className="px-3 py-2 text-right tabular-nums">{sum("outcomes").toLocaleString()}</td>
            {showValue && <td className="px-4 py-2 text-right tabular-nums">{formatMoney(sum("valueCents"))}</td>}
          </tr>
        </tfoot>
      </table>
      <p className="px-4 pb-3 text-xs text-text-faint">* Someone who came in during several months is counted once in each month.</p>
    </div>
  );
}
