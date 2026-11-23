"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { TrackedLink } from "@/components/marketing/landing/Track";

/**
 * "Built around you": the same day, without and with Surfdesk, for each audience.
 * Every "with" moment is a real feature (command box, lists, calendar sync, person history,
 * quiet-client automation, Insights/Impact, referrals, assignments, team chat).
 */

type Key = "individuals" | "business" | "nonprofits";
type Moment = { time: string; without: string; with: string };

const AUDIENCES: Record<Key, { tab: string; title: string; accent: string; moments: Moment[]; cta: string; href: string }> = {
  individuals: {
    tab: "Individuals",
    title: "Same day.",
    accent: "Less to carry.",
    moments: [
      { time: "7:30 AM", without: "Lying awake running through everything you need to do.", with: "You said it last night. Today's list is already waiting." },
      { time: "12:15 PM", without: "The grocery list is on a sticky note at home.", with: "Your shopping list is on your phone. Check it off as you go." },
      { time: "3:00 PM", without: "The dentist appointment is somewhere in a text thread.", with: "It's on your calendar, right next to your Google or Apple events." },
      { time: "9:00 PM", without: "Wondering what you forgot today.", with: "Today's list is clear and tomorrow is already planned." },
    ],
    cta: "Explore for Individuals",
    href: "/individuals",
  },
  business: {
    tab: "Business",
    title: "Same customers.",
    accent: "Nothing slips.",
    moments: [
      { time: "8:10 AM", without: "A customer texts a change. By noon it's buried.", with: "Say it once. It's on Ana's profile and your calendar." },
      { time: "11:30 AM", without: "You can't remember what you promised Ana last time.", with: "Her visits, notes and follow-ups are one tap away." },
      { time: "4:00 PM", without: "A regular hasn't been in for a month. Nobody notices.", with: "Surfdesk adds a check-in task when a customer goes quiet." },
      { time: "9:00 PM", without: "Adding up the week's revenue in a spreadsheet.", with: "Insights already did the math, by service and by day." },
    ],
    cta: "Explore for Business",
    href: "/business",
  },
  nonprofits: {
    tab: "Nonprofits",
    title: "Same mission.",
    accent: "Less paperwork.",
    moments: [
      { time: "8:30 AM", without: "A partner's referral sits unread in someone's inbox.", with: "The referral lands in Surfdesk and admins are notified." },
      { time: "10:00 AM", without: "Staff ask around: who's seeing Jasmine today?", with: "She's assigned in a tap, and the team talks about her in chat." },
      { time: "2:00 PM", without: "Check-in notes go in a notebook to type up later.", with: "One line logs the check-in and the service." },
      { time: "Month end", without: "A week of hand-counting people served for the funder.", with: "Your Impact report, with demographics, as a PDF in one click." },
    ],
    cta: "Explore for Nonprofits",
    href: "/nonprofits",
  },
};

const KEYS = Object.keys(AUDIENCES) as Key[];

export function AudienceExplorer({ page, startHref }: { page: string; startHref: string }) {
  const [key, setKey] = useState<Key>("individuals");
  const a = AUDIENCES[key];
  return (
    <div className="space-y-8">
      <div role="tablist" aria-label="Who is it for" className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-bg p-1">
        {KEYS.map((k) => (
          <button
            key={k}
            role="tab"
            id={`tab-${k}`}
            aria-selected={k === key}
            aria-controls="audience-panel"
            onClick={() => {
              setKey(k);
              track("Audience Tab", { page, audience: k });
            }}
            className={`rounded-full px-4 py-2 text-sm transition-colors sm:px-5 ${k === key ? "bg-accent font-semibold text-bg" : "text-text-muted hover:text-text"}`}
          >
            {AUDIENCES[k].tab}
          </button>
        ))}
      </div>

      <div id="audience-panel" role="tabpanel" aria-labelledby={`tab-${key}`} key={key} className="space-y-6 motion-safe:animate-[step-in_300ms_ease-out]">
        <h3 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
          {a.title} <span className="text-accent">{a.accent}</span>
        </h3>

        <div className="hidden grid-cols-[6rem_1fr_1fr] gap-4 px-5 sm:grid">
          <span />
          <p className="eyebrow text-text-faint">Without Surfdesk</p>
          <p className="eyebrow text-accent">With Surfdesk</p>
        </div>
        <ol className="space-y-3">
          {a.moments.map((m) => (
            <li key={m.time} className="card grid gap-3 p-5 sm:grid-cols-[6rem_1fr_1fr] sm:items-center sm:gap-4">
              <p className="font-display text-lg font-light tabular-nums text-text">{m.time}</p>
              <p className="flex items-start gap-3 text-sm leading-relaxed text-text-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-urgent-soft text-[11px] text-urgent" aria-label="Without Surfdesk">
                  ✕
                </span>
                {m.without}
              </p>
              <p className="flex items-start gap-3 rounded-xl bg-accent-soft p-3 text-sm font-medium leading-relaxed text-text">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-bg" aria-label="With Surfdesk">
                  ✓
                </span>
                {m.with}
              </p>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <TrackedLink
            page={page}
            cta={`day_start_${key}`}
            href={startHref}
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim"
          >
            Get your day back. Start free
          </TrackedLink>
          <TrackedLink page={page} cta={`audience_${key}`} href={a.href} className="text-sm font-semibold text-accent hover:underline">
            {a.cta} →
          </TrackedLink>
        </div>
      </div>
    </div>
  );
}
