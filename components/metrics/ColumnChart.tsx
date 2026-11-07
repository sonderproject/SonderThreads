"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/metrics-shared";

/**
 * Single-series column chart (one baseline, ≤24px columns with 4px rounded
 * tops, recessive hairline grid, value on the tallest column only) with a
 * hover tooltip per column. Sized to its container.
 */
export function ColumnChart({ data, unit, height = 180 }: { data: Point[]; unit: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...data.map((d) => d.value));
  const top = niceMax(max);
  const ticks = [0, top / 2, top];
  const left = 28;
  const bottom = 22;
  const padTop = 16; // room for the value label over the tallest column
  const plotH = height - bottom - padTop;
  const plotW = Math.max(0, width - left);
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => padTop + plotH - (top ? (v / top) * plotH : 0);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 64))));
  const peak = max > 0 ? data.findIndex((d) => d.value === max) : -1;
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${unit} over time, peak ${max}`} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width} y1={y(t)} y2={y(t)} stroke="var(--line-subtle)" strokeWidth="1" />
              <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)" className="tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = left + i * slot + (slot - barW) / 2;
            const yTop = y(d.value);
            const bh = padTop + plotH - yTop;
            const r = Math.min(4, barW / 2, bh);
            return (
              <g key={d.key}>
                {d.value > 0 && (
                  <path
                    d={`M${x} ${yTop + bh} V${yTop + r} Q${x} ${yTop} ${x + r} ${yTop} H${x + barW - r} Q${x + barW} ${yTop} ${x + barW} ${yTop + r} V${yTop + bh} Z`}
                    fill="var(--chart-1)"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                {i === peak && hover === null && (
                  <text x={x + barW / 2} y={yTop - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--fg)" className="tabular-nums">
                    {d.value}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text x={left + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                    {d.label}
                  </text>
                )}
                {/* Hit target: the whole column slot, bigger than the mark. */}
                <rect
                  x={left + i * slot}
                  y={0}
                  width={slot}
                  height={height - bottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-bg-raised px-2 py-1 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(left + hover * slot + slot / 2, 60), width - 60) }}
        >
          <span className="text-text-muted">{h.label}</span> ·{" "}
          <strong className="tabular-nums text-text">{h.value}</strong> <span className="text-text-muted">{unit}</span>
        </div>
      )}
    </div>
  );
}

/** Round a max up to a clean axis top: 1, 2, 5 × 10ⁿ (at least 2 so ticks stay whole). */
function niceMax(v: number): number {
  if (v <= 2) return 2;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function compact(n: number): string {
  return n >= 10_000 ? `${Math.round(n / 1000)}K` : Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}
