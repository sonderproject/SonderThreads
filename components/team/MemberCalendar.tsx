"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { Dot, itemColor } from "@/components/calendar/CalendarItems";
import { formatMinutes, groupByDay, parseKey, type CalendarItem, type ViewRange } from "@/lib/calendar-items";

/** A member's month, view-only (Team → member). Tasks and linked-calendar events arrive as "Busy". */
export function MemberCalendar({
  range,
  anchor,
  today,
  items,
  prevHref,
  nextHref,
}: {
  range: ViewRange;
  anchor: string;
  today: string;
  items: CalendarItem[];
  prevHref: string;
  nextHref: string;
}) {
  const byDay = useMemo(() => groupByDay(items), [items]);
  const month = parseKey(anchor).month;
  const startOn = today >= range.from && today <= range.to && parseKey(today).month === month ? today : anchor;
  const [selected, setSelected] = useState(startOn);
  const dayItems = byDay[selected] ?? [];
  const dayLabel = new Date(`${selected}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">{range.label}</p>
        <div className="flex gap-1 text-sm">
          <Link href={prevHref} scroll={false} className="rounded-full border border-border px-3 py-1 hover:bg-bg-hover" aria-label="Previous month">
            ←
          </Link>
          <Link href={nextHref} scroll={false} className="rounded-full border border-border px-3 py-1 hover:bg-bg-hover" aria-label="Next month">
            →
          </Link>
        </div>
      </div>
      <MonthGrid
        from={range.from}
        to={range.to}
        month={month}
        today={today}
        selected={selected}
        byDay={byDay}
        completedOverrides={{}}
        onSelect={setSelected}
      />
      <div className="card p-4">
        <p className="eyebrow mb-2 text-text-faint">{dayLabel}</p>
        {dayItems.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {dayItems.map((it) => (
              <li key={it.key} className="flex items-center gap-2">
                <Dot color={itemColor(it, today)} />
                <span className="w-24 shrink-0 tabular-nums text-text-muted">
                  {it.minutes === null
                    ? "All day"
                    : `${formatMinutes(it.minutes)}${it.endMinutes ? `–${formatMinutes(it.endMinutes)}` : ""}`}
                </span>
                {it.href ? (
                  <Link href={it.href} className="truncate text-text hover:text-accent">
                    {it.kind === "birthday" ? `${it.title}'s birthday` : it.title}
                  </Link>
                ) : (
                  <span className="truncate text-text">{it.title}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
