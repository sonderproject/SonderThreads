"use client";

import { Dot, itemColor } from "@/components/calendar/CalendarItems";
import { daysBetween, formatMinutes, parseKey, type CalendarItem } from "@/lib/calendar-items";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

/**
 * The month as a grid. Phones show colored dots per day; wider screens show
 * up to three items per day and "+N more". Clicking a day selects it.
 */
export function MonthGrid({
  from,
  to,
  month,
  today,
  selected,
  byDay,
  completedOverrides,
  onSelect,
}: {
  from: string;
  to: string;
  /** The month being shown (1-12); days outside it are dimmed. */
  month: number;
  today: string;
  selected: string | null;
  byDay: Record<string, CalendarItem[]>;
  completedOverrides: Record<string, boolean>;
  onSelect: (day: string) => void;
}) {
  const days = daysBetween(from, to);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((label) => (
          <div key={label} className="eyebrow py-2 text-center !tracking-[0.12em]">
            <span className="sm:hidden">{label[0]}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const items = byDay[day] ?? [];
          const { day: dayNum, month: m } = parseKey(day);
          const inMonth = m === month;
          const isToday = day === today;
          const isSelected = day === selected;
          const extra = items.length - MAX_CHIPS;
          const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          });
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={`${label}${items.length ? `, ${items.length} item${items.length === 1 ? "" : "s"}` : ""}`}
              className={`group flex min-h-[3.25rem] flex-col items-stretch gap-1 border-border-subtle p-1 text-left transition-colors hover:bg-bg-hover sm:min-h-[6.5rem] sm:p-1.5 ${
                i % 7 === 6 ? "" : "border-r"
              } ${i < days.length - 7 ? "border-b" : ""} ${isSelected ? "bg-accent-soft hover:bg-accent-soft" : ""}`}
            >
              <span className="flex justify-center sm:justify-start">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums ${
                    isToday ? "bg-accent font-semibold text-bg" : inMonth ? "text-text" : "text-text-faint opacity-60"
                  }`}
                >
                  {dayNum}
                </span>
              </span>

              {/* Phones: up to four dots. */}
              {items.length > 0 && (
                <span className="flex justify-center gap-0.5 sm:hidden">
                  {items.slice(0, 4).map((it) => (
                    <Dot key={it.key} color={itemColor(it, today)} className="h-1.5 w-1.5" />
                  ))}
                </span>
              )}

              {/* Wider screens: the first few items, then a count. */}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {items.slice(0, MAX_CHIPS).map((it) => {
                  const done = it.kind === "task" && (it.taskId ? (completedOverrides[it.taskId] ?? it.completed) : it.completed);
                  return (
                    <span key={it.key} className="flex min-w-0 items-center gap-1 text-[11px] leading-4">
                      <Dot color={itemColor({ ...it, completed: done }, today)} className="h-1.5 w-1.5" />
                      {it.minutes !== null && (
                        <span className="shrink-0 tabular-nums text-text-muted">{formatMinutes(it.minutes).replace(":00", "").replace(" ", "").toLowerCase()}</span>
                      )}
                      <span className={`truncate ${done ? "text-text-faint line-through" : "text-text"}`}>{it.title}</span>
                    </span>
                  );
                })}
                {extra > 0 && <span className="text-[11px] font-medium text-accent">+{extra} more</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
