"use client";

import { useEffect, useState } from "react";

const ACCENT = "var(--color-accent)";
const tint = (pct: number) => `color-mix(in srgb, var(--color-accent) ${pct}%, transparent)`;
const GLOW = `0 0 4px ${tint(60)}, 0 0 14px ${tint(35)}`;

const pad = (n: number) => String(n).padStart(2, "0");

/** Live local clock in terminal style, in the app accent color. Renders nothing until mounted so server and browser time zones can't mismatch. */
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours12 = now ? now.getHours() % 12 || 12 : 0;
  const cursorOn = now ? now.getSeconds() % 2 === 0 : true;

  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden rounded border bg-bg-raised px-5 py-4"
      style={{ borderColor: tint(35), boxShadow: `inset 0 0 24px ${tint(6)}` }}
    >
      {/* CRT scanlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)",
        }}
      />
      {now && (
        <div className="relative text-center font-mono" style={{ color: ACCENT }}>
          <p className="text-[11px] uppercase tracking-widest opacity-60">&gt; system.time</p>
          <p className="mt-1 text-6xl leading-none tabular-nums" style={{ textShadow: GLOW }}>
            {pad(hours12)}:{pad(now.getMinutes())}
            <span className="text-3xl opacity-70">:{pad(now.getSeconds())}</span>
            <span className="ml-1 text-2xl">{now.getHours() < 12 ? "AM" : "PM"}</span>
          </p>
          <p className="mt-2 text-sm uppercase tracking-wide" style={{ textShadow: `0 0 6px ${tint(40)}` }}>
            {now.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
            <span
              aria-hidden
              className="ml-1 inline-block h-3.5 w-2 translate-y-0.5"
              style={{ backgroundColor: ACCENT, opacity: cursorOn ? 1 : 0 }}
            />
          </p>
        </div>
      )}
    </div>
  );
}
