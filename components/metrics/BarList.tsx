import Link from "next/link";
import type { Point } from "@/lib/metrics-shared";

/**
 * Horizontal bars for a ranked or categorical breakdown: label on the left,
 * a ≤14px bar from a shared baseline with a rounded end, value at the tip.
 * Text stays in text colors; only the bar carries the chart color.
 */
export function BarList({ data, unit, hrefFor }: { data: (Point & { personId?: string })[]; unit: string; hrefFor?: (p: Point & { personId?: string }) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.key} className="group grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 text-sm" title={`${d.label}: ${d.value} ${unit}`}>
          {hrefFor ? (
            <Link href={hrefFor(d)} className="break-words leading-tight text-text hover:text-accent">
              {d.label}
            </Link>
          ) : (
            <span className="break-words leading-tight text-text">{d.label}</span>
          )}
          <span className="flex items-center gap-2">
            {d.value > 0 && (
              <span
                className="h-3.5 rounded-r opacity-90 transition-opacity group-hover:opacity-100"
                style={{ width: `calc(${(d.value / max) * 100}% - 2.5rem)`, minWidth: 3, background: "var(--chart-1)" }}
              />
            )}
            <span className="tabular-nums text-xs font-semibold text-text-muted">{d.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
