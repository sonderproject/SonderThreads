"use client";

import { useEffect, useState } from "react";

/** What a person types, and what Surfdesk makes of it. */
const EXAMPLES = [
  { said: "Remind me to call Sarah Friday at 3", kind: "Task", detail: "Fri 3:00 PM · linked to Sarah" },
  { said: "Marcus got the job at Amazon", kind: "Note", detail: "Added to Marcus's profile" },
  { said: "Ana – haircut $45", kind: "Service", detail: "Haircut · $45 · today" },
  { said: "Call Jo every Monday", kind: "Repeating task", detail: "Every Monday · linked to Jo" },
];

/**
 * Landing page: a sentence types itself into a command bar, then shows what
 * Surfdesk did with it. Cycles through a few examples; with reduced motion it
 * shows them all, still.
 */
export function CommandDemo() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (still) return;
    const text = EXAMPLES[i].said;
    if (typed < text.length) {
      const t = setTimeout(() => setTyped((n) => n + 1), 45);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setTyped(0);
      setI((n) => (n + 1) % EXAMPLES.length);
    }, 2400);
    return () => clearTimeout(t);
  }, [i, typed, still]);

  if (still) {
    return (
      <ul className="space-y-2">
        {EXAMPLES.map((e) => (
          <li key={e.said} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm">
            <span className="text-text">“{e.said}”</span>
            <span className="block text-xs text-text-muted">
              → {e.kind}: {e.detail}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const e = EXAMPLES[i];
  const done = typed >= e.said.length;
  return (
    <div className="space-y-3" aria-hidden>
      <div className="flex items-center gap-2 rounded-full border border-border bg-bg px-4 py-3 shadow-sm">
        <span className="text-accent">/</span>
        <span className="min-w-0 flex-1 truncate text-sm text-text sm:text-base">
          {e.said.slice(0, typed)}
          <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-accent" />
        </span>
        <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-semibold text-bg sm:inline">Enter</span>
      </div>
      <div
        className={`flex items-center gap-3 rounded-2xl border border-border bg-bg-raised px-4 py-3 transition-[opacity,transform] duration-300 ${
          done ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-bg">
          ✓
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-text">{e.kind} created</span>
          <span className="block truncate text-xs text-text-muted">{e.detail}</span>
        </span>
      </div>
    </div>
  );
}
