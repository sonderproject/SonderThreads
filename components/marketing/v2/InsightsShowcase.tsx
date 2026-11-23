"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { BarList } from "@/components/metrics/BarList";
import { ReachChart } from "@/components/impact/ReachChart";
import { BusiestTimes } from "@/components/impact/BusiestTimes";
import { Reveal } from "./Decor";

/**
 * "See how you're doing": the app's own Insights / Impact charts (ReachChart, BarList,
 * BusiestTimes) with sample data, so visitors see the real reports, not a drawing of them.
 */

const MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

/** Busiest times: 7 days x 12 two-hour blocks (12a..10p), sample counts. */
function grid(peaks: [number, number, number][]): number[][] {
  const g = Array.from({ length: 7 }, () => Array(12).fill(0));
  for (const [d, b, n] of peaks) g[d][b] = n;
  return g;
}

const DATA = {
  business: {
    tab: "Business · Insights",
    kpis: [
      { label: "Revenue", value: "$4,820", change: "+12% vs October", up: true },
      { label: "Visits", value: "142", change: "+8%", up: true },
      { label: "New customers", value: "38", change: "+5", up: true },
      { label: "Tasks completed", value: "96", change: "+18%", up: true },
    ],
    reach: { title: "Customers served", subtitle: "Per month, returning and first visit" },
    reachData: [
      [58, 14],
      [61, 19],
      [64, 17],
      [70, 22],
      [76, 25],
      [81, 28],
    ],
    list: {
      title: "Top services",
      subtitle: "Visits in November",
      unit: "visits",
      data: [
        ["Haircut", 43],
        ["Blowout", 27],
        ["Beard trim", 22],
        ["Color", 13],
        ["Consultation", 9],
      ] as [string, number][],
    },
    third: "busiest" as const,
    heat: grid([
      [1, 5, 3], [1, 6, 4], [1, 8, 2],
      [2, 5, 4], [2, 6, 5], [2, 7, 3], [2, 8, 4],
      [3, 5, 3], [3, 6, 6], [3, 8, 5], [3, 9, 4],
      [4, 5, 5], [4, 6, 7], [4, 7, 6], [4, 8, 8], [4, 9, 6],
      [5, 4, 6], [5, 5, 12], [5, 6, 10], [5, 7, 7],
      [6, 5, 3], [6, 6, 4],
    ]),
  },
  nonprofit: {
    tab: "Nonprofit · Impact",
    kpis: [
      { label: "People served", value: "213", change: "+9% vs October", up: true },
      { label: "Check-ins", value: "412", change: "+14%", up: true },
      { label: "New people", value: "65", change: "+11", up: true },
      { label: "Outcomes reached", value: "31", change: "jobs, housing, completions", up: null },
    ],
    reach: { title: "People served", subtitle: "Per month, returning and first visit" },
    reachData: [
      [121, 34],
      [128, 41],
      [134, 38],
      [140, 47],
      [146, 52],
      [148, 65],
    ],
    list: {
      title: "Reasons for visits",
      subtitle: "Check-ins by reason",
      unit: "check-ins",
      data: [
        ["Housing help", 82],
        ["Food assistance", 61],
        ["Job readiness", 44],
        ["Benefits help", 29],
        ["Transportation", 17],
      ] as [string, number][],
    },
    third: "who" as const,
    who: [
      ["Under $15K", 88],
      ["$15K–$30K", 64],
      ["$30K–$50K", 39],
      ["Over $50K", 12],
      ["Not given", 10],
    ] as [string, number][],
  },
};

type Key = keyof typeof DATA;

function Card({ title, subtitle, wide = false, children }: { title: string; subtitle: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`card space-y-4 p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <div>
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

const points = (rows: [string, number][]) => rows.map(([label, value]) => ({ key: label, label, value }));

export function InsightsShowcase({ page }: { page: string }) {
  const [key, setKey] = useState<Key>("business");
  const d = DATA[key];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Report type" className="inline-flex gap-1 rounded-full border border-border bg-bg-raised p-1">
          {(Object.keys(DATA) as Key[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === key}
              onClick={() => {
                setKey(k);
                track("Insights Tab", { page, report: k });
              }}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${k === key ? "bg-accent font-semibold text-bg" : "text-text-muted hover:text-text"}`}
            >
              {DATA[k].tab}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-2 rounded-full border border-border bg-bg-raised px-3 py-1.5 text-xs text-text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-accent" aria-hidden>
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6M12 12v6M9 15l3 3 3-3" />
          </svg>
          One click to a PDF report with your logo
        </span>
      </div>

      <Reveal key={key} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {d.kpis.map((k) => (
            <div key={k.label} className="card px-4 py-3.5">
              <p className="text-xs text-text-muted">{k.label}</p>
              <p className="mt-1 font-display text-3xl font-light tabular-nums text-text">{k.value}</p>
              <p className={`mt-0.5 text-[11px] ${k.up ? "text-accent" : "text-text-muted"}`}>
                {k.up ? "↑ " : ""}
                {k.change}
              </p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={d.reach.title} subtitle={d.reach.subtitle} wide>
            <ReachChart data={d.reachData.map(([returning, first], i) => ({ key: MONTHS[i], label: MONTHS[i], returning, first }))} height={210} />
          </Card>
          <Card title={d.list.title} subtitle={d.list.subtitle}>
            <BarList data={points(d.list.data)} unit={d.list.unit} />
          </Card>
          {d.third === "busiest" ? (
            <div className="hidden sm:block">
              <Card title="Busiest times" subtitle="Visits by day and time">
                <BusiestTimes grid={DATA.business.heat} />
              </Card>
            </div>
          ) : (
            <div className="hidden sm:block">
              <Card title="Who we serve" subtitle="People served by income level">
                <BarList data={points(DATA.nonprofit.who)} unit="people" />
              </Card>
            </div>
          )}
        </div>
      </Reveal>
      <p className="text-[11px] text-text-faint">Sample data. These are the charts from Surfdesk&apos;s {key === "business" ? "Insights" : "Impact"} report.</p>
    </div>
  );
}
