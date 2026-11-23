"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { TrackedLink } from "@/components/marketing/landing/Track";
import { AppStackCalc, FollowUpCalc, HoursBackCalc } from "./Calculators";

type Key = "individuals" | "business" | "nonprofits";

const AUDIENCES: Record<
  Key,
  { tab: string; title: string; accent: string; body: string; points: string[]; cta: string; href: string; Calc: (p: { page: string }) => React.ReactElement }
> = {
  individuals: {
    tab: "Individuals",
    title: "Less to remember.",
    accent: "More room to live.",
    body: "Tasks, reminders, notes, lists and your calendar, organized without making organization another chore.",
    points: ["Say it or type it, and it's filed", "Repeating tasks and reminders", "Shopping lists, notes and ideas", "Google, Apple or Outlook calendar linked in"],
    cta: "Explore for Individuals",
    href: "/individuals",
    Calc: AppStackCalc,
  },
  business: {
    tab: "Business",
    title: "Know your customers.",
    accent: "Know your numbers.",
    body: "Customers, visits, bookings, follow-ups and your team, with revenue Insights from the visits you already log.",
    points: ["Every customer's history on one page", "Log a visit and price in one line", "Follow-ups on the right day", "Team chat, roles and a booking link"],
    cta: "Explore for Business",
    href: "/business",
    Calc: FollowUpCalc,
  },
  nonprofits: {
    tab: "Nonprofits",
    title: "Your people and programs.",
    accent: "Your impact, visible.",
    body: "Coordinate staff, manage participants, track services and show your impact, in one organized workspace.",
    points: ["Check-ins and services in one line", "Referral link and staff assignments", "Team dashboard and activity log", "Impact reports with demographics, as a PDF"],
    cta: "Explore for Nonprofits",
    href: "/nonprofits",
    Calc: HoursBackCalc,
  },
};

const KEYS = Object.keys(AUDIENCES) as Key[];

/** "Built around you": pick who you are, see what matters to you and what it's worth. */
export function AudienceExplorer({ page }: { page: string }) {
  const [key, setKey] = useState<Key>("individuals");
  const a = AUDIENCES[key];
  const pick = (k: Key) => {
    setKey(k);
    track("Audience Tab", { page, audience: k });
  };
  return (
    <div className="space-y-8">
      <div role="tablist" aria-label="Who is it for" className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-bg-raised p-1">
        {KEYS.map((k) => (
          <button
            key={k}
            role="tab"
            id={`tab-${k}`}
            aria-selected={k === key}
            aria-controls="audience-panel"
            onClick={() => pick(k)}
            className={`rounded-full px-4 py-2 text-sm transition-colors sm:px-5 ${k === key ? "bg-accent font-semibold text-bg" : "text-text-muted hover:text-text"}`}
          >
            {AUDIENCES[k].tab}
          </button>
        ))}
      </div>
      <div id="audience-panel" role="tabpanel" aria-labelledby={`tab-${key}`} className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div key={key} className="space-y-5 motion-safe:animate-[step-in_300ms_ease-out]">
          <h3 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
            {a.title} <span className="block text-accent">{a.accent}</span>
          </h3>
          <p className="max-w-md text-base leading-relaxed text-text-muted">{a.body}</p>
          <ul className="space-y-2.5">
            {a.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-text">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] text-accent" aria-hidden>
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
          <TrackedLink page={page} cta={`audience_${key}`} href={a.href} className="inline-block text-sm font-semibold text-accent hover:underline">
            {a.cta} →
          </TrackedLink>
        </div>
        <div key={`${key}-calc`} className="card p-5 motion-safe:animate-[step-in_300ms_ease-out] sm:p-6">
          <a.Calc page={page} />
        </div>
      </div>
    </div>
  );
}
