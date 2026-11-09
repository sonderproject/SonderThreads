"use client";

import { useEffect, useRef, useState } from "react";
import type { ReachPoint } from "@/lib/metrics-shared";

/**
 * People served per period, stacked: returning (series 1, on the baseline)
 * and first-time (series 2, on top), with a 2px surface gap between the two,
 * 4px rounded top on the stack, a legend, and a hover tooltip per column.
 */
export function ReachChart({ data, height = 200 }: { data: ReachPoint[]; height?: number }) {
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

  const totals = data.map((d) => d.first + d.returning);
  const max = Math.max(0, ...totals);
  const top = niceMax(max);
  const left = 28;
  const bottom = 22;
  const padTop = 8;
  const plotH = height - bottom - padTop;
  const plotW = Math.max(0, width - left);
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => padTop + plotH - (top ? (v / top) * plotH : 0);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 64))));
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-1)" }} /> Returning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-2)" }} /> First visit
        </span>
      </div>
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`People served over time, up to ${max} in one period`} className="block">
            {[0, top / 2, top].map((t) => (
              <g key={t}>
                <line x1={left} x2={width} y1={y(t)} y2={y(t)} stroke="var(--line-subtle)" />
                <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = left + i * slot + (slot - barW) / 2;
              const base = padTop + plotH;
              const retH = base - y(d.returning);
              const totalTop = y(d.first + d.returning);
              const firstH = d.first > 0 ? Math.max(0, y(d.returning) - totalTop - (d.returning > 0 ? 2 : 0)) : 0;
              const dim = hover === null || hover === i ? 1 : 0.45;
              const r = (hh: number) => Math.min(4, barW / 2, hh);
              const rounded = (yy: number, hh: number) =>
                `M${x} ${yy + hh} V${yy + r(hh)} Q${x} ${yy} ${x + r(hh)} ${yy} H${x + barW - r(hh)} Q${x + barW} ${yy} ${x + barW} ${yy + r(hh)} V${yy + hh} Z`;
              return (
                <g key={d.key} opacity={dim}>
                  {d.returning > 0 &&
                    (d.first > 0 ? (
                      <rect x={x} y={base - retH} width={barW} height={retH} fill="var(--chart-1)" />
                    ) : (
                      <path d={rounded(base - retH, retH)} fill="var(--chart-1)" />
                    ))}
                  {firstH > 0 && <path d={rounded(totalTop, firstH)} fill="var(--chart-2)" />}
                  {i % labelEvery === 0 && (
                    <text x={left + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--muted)" opacity={1}>
                      {d.label}
                    </text>
                  )}
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
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-border bg-bg-raised px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(left + hover * slot + slot / 2, 80), width - 80) }}
          >
            <p className="font-semibold text-text">{h.label}</p>
            <p className="tabular-nums text-text-muted">
              {h.first + h.returning} people · {h.returning} returning · {h.first} first visit
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 2) return 2;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
