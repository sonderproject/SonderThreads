import { TILES, change } from "@/lib/dashboard-shared";
import type { Tile } from "@/lib/dashboard";

const TONE: Record<string, string> = { positive: "var(--chart-1)", neutral: "var(--chart-3)", unplanned: "var(--chart-2)" };

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (v / max) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      <polyline points={`0,32 ${pts} 100,32`} fill="var(--chart-1)" opacity="0.12" stroke="none" />
      <polyline points={pts} fill="none" stroke="var(--chart-1)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** One dashboard tile: the number, the change from the period before, and a small trend or breakdown. */
export function TileCard({ tile, checkIns, compare }: { tile: Tile; checkIns: string; compare: boolean }) {
  const def = TILES.find((t) => t.key === tile.key)!;
  const label = def.label({ checkIns });
  const money = tile.key === "revenue";
  const value = money ? dollars(tile.value) : tile.value.toLocaleString("en-US");
  const breakdown = tile.key === "top_services" || tile.key === "gender";
  const pct = change(tile.value, tile.prev);
  const max = Math.max(1, ...(tile.parts ?? []).map((p) => p.value));
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-text-muted">{label}</p>
        {compare && !breakdown && (
          <span className={`tag ${pct === null ? "tag-n" : pct > 0 ? "tag-v" : pct < 0 ? "tag-e" : ""}`} title="Compared with the period before">
            {pct === null ? "New" : `${pct > 0 ? "+" : ""}${pct}%`}
          </span>
        )}
      </div>
      {!breakdown && <p className="text-3xl font-semibold tabular-nums text-text">{value}</p>}
      {compare && !breakdown && (
        <p className="text-xs text-text-faint">{money ? dollars(tile.prev) : tile.prev.toLocaleString("en-US")} the period before</p>
      )}
      {tile.note && <p className="text-xs text-text-muted">{tile.note}</p>}
      {tile.key === "exits" && tile.parts && tile.value > 0 && (
        <div className="space-y-1.5">
          <div className="flex h-2 overflow-hidden rounded-full bg-bg-hover" role="img" aria-label={tile.parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
            {tile.parts.map((p) => (p.value ? <div key={p.label} style={{ width: `${(p.value / tile.value) * 100}%`, background: TONE[p.tone ?? "positive"] }} /> : null))}
          </div>
          <p className="flex flex-wrap gap-x-3 text-xs text-text-muted">
            {tile.parts.map((p) => (
              <span key={p.label} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: TONE[p.tone ?? "positive"] }} aria-hidden /> {p.label} {p.value}
              </span>
            ))}
          </p>
        </div>
      )}
      {breakdown &&
        (tile.parts?.length ? (
          <ul className="space-y-1.5">
            {tile.parts.map((p) => (
              <li key={p.label} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-text">{p.label}</span>
                  <span className="tabular-nums text-text-muted">{p.value}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-bg-hover">
                  <div className="h-1.5 rounded-full" style={{ width: `${(p.value / max) * 100}%`, background: "var(--chart-1)" }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Nothing in this period yet.</p>
        ))}
      {tile.key !== "exits" && !breakdown && <Spark data={tile.series} />}
    </div>
  );
}
