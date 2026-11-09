"use client";

import { useState } from "react";
import { HEATMAP_BLOCKS, WEEKDAY_NAMES } from "@/lib/metrics-shared";

/**
 * Check-ins by weekday × 2-hour block. Sequential single hue (the brand blue
 * mixed into the surface, light → dark), empty cells stay the surface tint,
 * hover shows the exact count. Hours with no check-ins all week are hidden.
 */
export function BusiestTimes({ grid }: { grid: number[][] }) {
  const [hover, setHover] = useState<{ d: number; b: number } | null>(null);
  const max = Math.max(0, ...grid.flat());
  const cols = HEATMAP_BLOCKS.map((_, b) => b).filter((b) => grid.some((row) => row[b] > 0));
  const shown = cols.length ? cols : [4, 5, 6, 7, 8]; // 8a–6p when there's no data yet
  const step = (n: number) => (n === 0 ? 0 : Math.ceil((n / Math.max(1, max)) * 4)); // 1..4
  const fill = (n: number) =>
    step(n) === 0
      ? "var(--hover)"
      : `color-mix(in srgb, var(--chart-1) ${[0, 25, 50, 75, 100][step(n)]}%, var(--surface))`;
  const h = hover ? grid[hover.d][hover.b] : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th />
              {shown.map((b) => (
                <th key={b} className="text-[10px] font-normal text-text-muted">
                  {HEATMAP_BLOCKS[b]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, d) => (
              <tr key={d}>
                <th className="pr-1 text-left text-[11px] font-normal text-text-muted">{WEEKDAY_NAMES[d].slice(0, 3)}</th>
                {shown.map((b) => (
                  <td
                    key={b}
                    onMouseEnter={() => setHover({ d, b })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setHover({ d, b })}
                    className="h-7 min-w-7 rounded-md"
                    style={{ background: fill(row[b]), outline: hover?.d === d && hover?.b === b ? "2px solid var(--fg)" : undefined }}
                    title={`${WEEKDAY_NAMES[d]} ${HEATMAP_BLOCKS[b]}m: ${row[b]} check-ins`}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          Fewer
          {[0, 1, 2, 3, 4].map((sIdx) => (
            <span
              key={sIdx}
              className="h-3 w-5 rounded"
              style={{ background: sIdx === 0 ? "var(--hover)" : `color-mix(in srgb, var(--chart-1) ${sIdx * 25}%, var(--surface))` }}
            />
          ))}
          More
        </span>
        <span className="tabular-nums">
          {hover && h !== null ? `${WEEKDAY_NAMES[hover.d]} ${HEATMAP_BLOCKS[hover.b]}m: ${h} check-ins` : "Tap a square for its count"}
        </span>
      </div>
    </div>
  );
}
