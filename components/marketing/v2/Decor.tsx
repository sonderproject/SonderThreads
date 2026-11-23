"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Soft color glows that drift slowly behind a section, from the brand palette
 * (surf blue, warm amber, violet). Decorative only. Still with reduced motion.
 */
export function Aurora({ tones = ["var(--accent)", "var(--warn)", "var(--new)"], strength = 1, className = "" }: { tones?: string[]; strength?: number; className?: string }) {
  const spots = [
    { left: "-10%", top: "-20%", size: "55%", tone: tones[0], pct: 22 },
    { left: "60%", top: "-10%", size: "45%", tone: tones[1], pct: 14 },
    { left: "30%", top: "45%", size: "50%", tone: tones[2], pct: 12 },
  ];
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {spots.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full blur-3xl motion-safe:animate-[aurora_18s_ease-in-out_infinite_alternate]"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            aspectRatio: "1",
            animationDelay: `${i * -6}s`,
            background: `radial-gradient(circle, color-mix(in srgb, ${s.tone} ${Math.round(s.pct * strength)}%, transparent), transparent 70%)`,
          }}
        />
      ))}
    </div>
  );
}

/** Adds `is-in` once its children scroll into view (charts grow in, see .chart-reveal in globals.css). */
export function Reveal({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setInView(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`chart-reveal ${inView ? "is-in" : ""} ${className}`}>
      {children}
    </div>
  );
}
