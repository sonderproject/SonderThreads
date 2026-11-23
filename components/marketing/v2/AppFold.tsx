"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Not five different apps", as a picture: five generic app tiles drift together and
 * fold into Surfdesk as you scroll. Generic glyphs only, no other company's logos.
 * With reduced motion it shows the before and after side by side, still.
 */

const APPS: { label: string; tone: string; at: [number, number]; icon: React.ReactNode }[] = [
  {
    label: "Notes app",
    tone: "tag-e",
    at: [-1, -0.55],
    icon: <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h6M9 17h3" />,
  },
  {
    label: "Reminders",
    tone: "tag-u",
    at: [1, -0.6],
    icon: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />,
  },
  {
    label: "Calendar",
    tone: "tag-n",
    at: [-1.15, 0.55],
    icon: <path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 4v4M16 4v4" />,
  },
  {
    label: "Spreadsheet",
    tone: "tag-v",
    at: [1.15, 0.5],
    icon: <path d="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14" />,
  },
  {
    label: "Texts",
    tone: "tag-e",
    at: [0, 1],
    icon: <path d="M20 12a7 7 0 0 1-10.3 6.2L5 19.5l1.3-4.2A7 7 0 1 1 20 12z" />,
  },
];

const ONE = ["Tasks", "Notes", "Lists", "Reminders", "Calendar", "Clients", "Team chat"];

function Tile({ app, size = 64, labelOpacity = 1 }: { app: (typeof APPS)[number]; size?: number; labelOpacity?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className={`tag ${app.tone} !ml-0 flex items-center justify-center !rounded-2xl !p-0`} style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-1/2 w-1/2" aria-hidden>
          {app.icon}
        </svg>
      </span>
      <span className="whitespace-nowrap text-xs text-text-muted" style={{ opacity: labelOpacity }}>
        {app.label}
      </span>
    </div>
  );
}

function SurfdeskTile({ size = 112 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[28px] border border-accent bg-bg-raised"
      style={{ width: size, height: size, boxShadow: "0 20px 60px -20px color-mix(in srgb, var(--accent) 55%, transparent)" }}
    >
      <span className="brand-mark h-12 w-[64px]" aria-hidden />
    </span>
  );
}

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const ease = (t: number) => t * t * (3 - 2 * t);

export function AppFold() {
  const section = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [still, setStill] = useState(false);
  const [spread, setSpread] = useState(200);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setP(clamp(-r.top / Math.max(1, r.height - window.innerHeight)));
      setSpread(Math.min(230, window.innerWidth * 0.27));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const heading = (
    <>
      <p className="eyebrow text-text-faint">One app instead of five</p>
      <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
        Notes here. Reminders there. Clients in a spreadsheet.
      </h2>
    </>
  );

  if (still) {
    return (
      <section className="space-y-10 bg-bg-raised px-4 py-16 text-center">
        <div className="mx-auto max-w-3xl space-y-3">{heading}</div>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {APPS.map((a) => (
            <Tile key={a.label} app={a} size={56} />
          ))}
          <span className="text-2xl text-text-muted" aria-hidden>
            →
          </span>
          <SurfdeskTile size={96} />
        </div>
        <p className="font-display text-3xl font-light text-accent">Now it&apos;s one place.</p>
      </section>
    );
  }

  const gather = ease(clamp(p / 0.5));
  const labels = 1 - ease(clamp(p / 0.25));
  const fold = ease(clamp((p - 0.3) / 0.3));
  const after = ease(clamp((p - 0.55) / 0.2));

  return (
    <section ref={section} className="relative h-[120vh] bg-bg-raised sm:h-[145vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center gap-6 overflow-hidden px-4 py-16 text-center">
        <div className="relative h-24 w-full max-w-3xl sm:h-28">
          <div className="absolute inset-0 space-y-3" style={{ opacity: 1 - after, transform: `translateY(${-after * 16}px)` }}>
            {heading}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3" style={{ opacity: after, transform: `translateY(${(1 - after) * 16}px)` }}>
            <p className="eyebrow text-text-faint">Surfdesk</p>
            <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
              Now it&apos;s <span className="text-accent">one place.</span>
            </h2>
          </div>
        </div>
        <div className="relative h-[300px] w-full max-w-xl sm:h-[360px]" aria-label="Five apps fold into Surfdesk" role="img">
          {APPS.map((a) => {
            const x = a.at[0] * spread * (1 - gather);
            const y = a.at[1] * 140 * (1 - gather);
            return (
              <div
                key={a.label}
                className="absolute left-1/2 top-1/2 will-change-transform"
                style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${1 - 0.45 * fold})`, opacity: 1 - fold }}
              >
                <Tile app={a} labelOpacity={labels} />
              </div>
            );
          })}
          <div
            className="absolute left-1/2 top-1/2 will-change-transform"
            style={{ transform: `translate(-50%, -50%) scale(${0.5 + 0.5 * fold})`, opacity: fold }}
          >
            <SurfdeskTile />
          </div>
        </div>
        <div className="flex max-w-xl flex-wrap justify-center gap-2" style={{ opacity: after }}>
          {ONE.map((x) => (
            <span key={x} className="rounded-full border border-border bg-bg-raised px-3 py-1 text-xs text-text">
              {x}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
