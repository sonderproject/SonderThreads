import Link from "next/link";
import type { CalendarDay } from "@/lib/calendar-utils";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function MiniCalendar({
  year,
  month,
  weeks,
  eventDays,
}: {
  year: number;
  month: number;
  weeks: CalendarDay[][];
  eventDays: Set<number>;
}) {
  return (
    <div className="max-w-xs rounded border border-border p-2">
      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="py-1 text-center font-mono text-[10px] text-text-faint">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((cell, i) => (
          <Link
            key={i}
            href={`/calendar?year=${year}&month=${month}`}
            className={`flex h-8 flex-col items-center justify-center rounded text-[11px] hover:bg-bg-hover ${
              cell.isToday ? "bg-accent/10 font-bold text-accent" : "text-text-muted"
            } ${!cell.dayNum ? "pointer-events-none" : ""}`}
          >
            <span>{cell.dayNum ?? ""}</span>
            {cell.dayNum && eventDays.has(cell.dayNum) && (
              <span className="-mt-0.5 h-1 w-1 rounded-full bg-accent" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
