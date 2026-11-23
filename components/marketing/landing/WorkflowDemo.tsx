"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";

export type WorkflowStep = {
  title: string;
  body: string;
  /** A small drawing of the screen for this step (sample data, app tokens). */
  screen: React.ReactNode;
};

/**
 * A real Surfdesk workflow, one step at a time. Steps advance on their own while
 * the demo is on screen (never with reduced motion); clicking a step takes over
 * and stops the auto-advance. Every step is a real feature; the screens are
 * drawings with sample data, labelled as such.
 */
export function WorkflowDemo({ page, steps, interval = 3800 }: { page: string; steps: WorkflowStep[]; interval?: number }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(false);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const engaged = useRef(false);

  useEffect(() => {
    setAuto(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !visible) return;
    const t = setTimeout(() => setActive((n) => (n + 1) % steps.length), interval);
    return () => clearTimeout(t);
  }, [active, auto, visible, interval, steps.length]);

  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
    if (!engaged.current) {
      engaged.current = true;
      track("Demo Interact", { page });
    }
  };

  const step = steps[active];
  return (
    <div ref={root} className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
      <ol className="order-2 space-y-2 lg:order-1">
        {steps.map((s, i) => {
          const on = i === active;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => pick(i)}
                aria-current={on ? "step" : undefined}
                className={`flex w-full gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  on ? "border-accent bg-bg-raised" : "border-border-subtle hover:bg-bg-hover"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                    on ? "bg-accent text-bg" : "bg-accent-soft text-accent"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">{s.title}</span>
                  {on && <span className="mt-0.5 block text-sm leading-relaxed text-text-muted">{s.body}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="order-1 lg:sticky lg:top-24 lg:order-2">
        <div className="card relative overflow-hidden p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="eyebrow text-text-faint">
              Step {active + 1} of {steps.length}
            </span>
            <span className="flex gap-1" aria-hidden>
              {steps.map((s, i) => (
                <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-accent" : "w-1.5 bg-border"}`} />
              ))}
            </span>
          </div>
          <div key={active} className="motion-safe:animate-[step-in_300ms_ease-out]" aria-hidden>
            {step.screen}
          </div>
          <p className="sr-only" aria-live="off">
            {step.title}. {step.body}
          </p>
        </div>
        <p className="mt-2 text-center text-[11px] text-text-faint">Drawn with sample data. Every step is a real Surfdesk feature.</p>
      </div>
    </div>
  );
}
