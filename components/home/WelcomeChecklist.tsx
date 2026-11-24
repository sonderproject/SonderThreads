"use client";

import { useTerms } from "@/components/TermsProvider";

import Link from "next/link";
import { useState, useTransition } from "react";
import { dismissWelcome } from "@/lib/actions/profile";
import type { WelcomeStep } from "@/lib/onboarding";

const COPY: Record<WelcomeStep["key"], { title: string; body: string; href?: string; cta?: string }> = {
  person: { title: "Add your first person", body: "A client, or anyone you want to keep track of.", href: "/people", cta: "Add a person" },
  checkin: { title: "Log a check-in", body: "Record a visit or a call. It powers your Impact report.", href: "/check-ins", cta: "Log a check-in" },
  note: {
    title: "Write a note or a task",
    body: "Type it in the box below, like “note: Maria starts work Monday” or “remind me to call Maria Thursday”.",
  },
  team: { title: "Invite a teammate", body: "They get their own login; you choose what they can see.", href: "/team", cta: "Invite someone" },
};

/** First-run checklist on Home: three steps that tick themselves off, with a progress bar. Hideable. */
export function WelcomeChecklist({ steps }: { steps: WelcomeStep[] }) {
  const terms = useTerms();
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();
  if (hidden) return null;
  const done = steps.filter((s) => s.done).length;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Getting started</p>
          <h2 className="mt-2 font-display text-xl font-light text-text">Welcome to Surfdesk</h2>
          <p className="text-sm text-text-muted">
            {done} of {steps.length} done{done === 0 ? ": a couple of minutes gets you set up" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            startTransition(() => dismissWelcome());
          }}
          className="text-xs text-text-muted hover:text-text"
        >
          Hide
        </button>
      </div>
      <div className="progress-bar" aria-hidden>
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const c =
            s.key === "checkin"
              ? {
                  ...COPY.checkin,
                  title: terms.logCheckIn,
                  cta: terms.logCheckIn,
                  body: `Record a visit or a call. It shows up in your ${terms.impact}.`,
                }
              : COPY[s.key];
          return (
            <li key={s.key} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  s.done ? "bg-accent text-bg" : "border border-border text-text-muted"
                }`}
                aria-label={s.done ? "Done" : `Step ${i + 1}`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className={`text-sm font-semibold ${s.done ? "text-text-muted line-through" : "text-text"}`}>{c.title}</p>
                {!s.done && <p className="text-xs text-text-muted">{c.body}</p>}
                {!s.done && c.href && (
                  <Link href={c.href} className="inline-block text-xs font-medium text-accent hover:underline">
                    {c.cta} →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
