import type { FollowThrough } from "@/lib/metrics-shared";

/**
 * Follow-ups due in the period: a plain count ("12 of 15 done", never a
 * percentage that can read as 0%) and one proportion bar: done on time (good),
 * done late (attention), not done yet (neutral). Status colors carry a label
 * and a number, never color alone; 2px surface gaps between segments.
 */
export function FollowThroughBar({ data }: { data: FollowThrough }) {
  if (data.due === 0) return <p className="py-6 text-center text-sm text-text-muted">No follow-ups were due in this period.</p>;
  const parts = [
    { key: "onTime", label: "On time", n: data.onTime, color: "var(--accent)" },
    { key: "late", label: "Late", n: data.late, color: "var(--warn)" },
    { key: "open", label: "Not done yet", n: data.open, color: "var(--line)" },
  ].filter((p) => p.n > 0);
  return (
    <div className="space-y-4">
      <p className="font-display text-4xl font-light tabular-nums text-text">
        {data.onTime + data.late} <span className="font-sans text-sm text-text-muted">of {data.due} done</span>
      </p>
      <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label} ${p.n}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${(p.n / data.due) * 100}%`, background: p.color }} title={`${p.label}: ${p.n}`} />
        ))}
      </div>
      <ul className="grid grid-cols-3 gap-2 text-xs">
        {[
          { label: "On time", n: data.onTime, color: "var(--accent)" },
          { label: "Late", n: data.late, color: "var(--warn)" },
          { label: "Not done yet", n: data.open, color: "var(--line)" },
        ]
          .filter((p) => p.n > 0)
          .map((p) => (
          <li key={p.label} className="space-y-0.5">
            <span className="flex items-center gap-1.5 text-text-muted">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="block tabular-nums text-sm font-semibold text-text">
              {p.n}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
