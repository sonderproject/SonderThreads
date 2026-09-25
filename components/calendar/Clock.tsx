"use client";

import { useEffect, useState } from "react";

const MATRIX_GREEN = "#00ff41";
const GLOW = `0 0 4px ${MATRIX_GREEN}, 0 0 12px rgba(0, 255, 65, 0.55), 0 0 24px rgba(0, 255, 65, 0.25)`;

const pad = (n: number) => String(n).padStart(2, "0");

/** Live local clock in green-phosphor terminal style. Renders nothing until mounted so server and browser time zones can't mismatch. */
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
      className="relative flex min-w-[13rem] flex-col justify-center overflow-hidden rounded border bg-black px-5 py-4"
      style={{ borderColor: "rgba(0, 255, 65, 0.35)", boxShadow: "inset 0 0 24px rgba(0, 255, 65, 0.08)" }}
    >
      {/* CRT scanlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)",
        }}
      />
      {now && (
        <div className="relative font-mono" style={{ color: MATRIX_GREEN }}>
          <p className="text-[11px] uppercase tracking-widest opacity-60">&gt; system.time</p>
          <p className="mt-1 text-6xl leading-none tabular-nums" style={{ textShadow: GLOW }}>
            {pad(hours12)}:{pad(now.getMinutes())}
            <span className="text-3xl opacity-70">:{pad(now.getSeconds())}</span>
            <span className="ml-1 text-2xl">{now.getHours() < 12 ? "AM" : "PM"}</span>
          </p>
          <p className="mt-2 text-sm uppercase tracking-wide" style={{ textShadow: `0 0 6px rgba(0, 255, 65, 0.5)` }}>
            {now.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
            <span
              aria-hidden
              className="ml-1 inline-block h-3.5 w-2 translate-y-0.5"
              style={{ backgroundColor: MATRIX_GREEN, opacity: cursorOn ? 1 : 0 }}
            />
          </p>
        </div>
      )}
    </div>
  );
}
