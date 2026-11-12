"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useTerms } from "@/components/TermsProvider";
import { Dot, ItemList } from "@/components/calendar/CalendarItems";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { NewCalendarItem } from "@/components/calendar/NewCalendarItem";
import { setTaskCompleted } from "@/lib/actions/tasks";
import {
  CALENDAR_VIEWS,
  MONTH_NAMES,
  daysBetween,
  groupByDay,
  longDayLabel,
  makeKey,
  parseKey,
  stepAnchor,
  type CalendarFeedStatus,
  type CalendarItem,
  type CalendarView as View,
  type ViewRange,
} from "@/lib/calendar-items";
import type { Person } from "@/lib/types";

const VIEW_LABELS: Record<View, string> = { month: "Month", week: "Week", agenda: "Agenda" };

function href(view: View, date: string): string {
  return `/calendar?view=${view}&date=${date}`;
}

export function CalendarView({
  view,
  anchor,
  range,
  today,
  items,
  feeds,
  people,
}: {
  view: View;
  anchor: string;
  range: ViewRange;
  today: string;
  items: CalendarItem[];
  feeds: CalendarFeedStatus[];
  people: Pick<Person, "id" | "display_name">[];
}) {
  const router = useRouter();
  const byDay = useMemo(() => groupByDay(items), [items]);
  const [, startTransition] = useTransition();

  // The selected day (month view's side panel, and where "+ New" adds).
  const initialSelected = today >= range.from && today <= range.to && (view !== "month" || parseKey(today).month === parseKey(anchor).month) ? today : anchor;
  const [selected, setSelected] = useState(initialSelected);
  useEffect(() => setSelected(initialSelected), [initialSelected]);

  const [adding, setAdding] = useState<string | null>(null);

  // Task check-offs show instantly; the server catches up on refresh.
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  useEffect(() => setCompleted({}), [items]);
  function toggle(item: CalendarItem) {
    if (!item.taskId) return;
    const next = !(completed[item.taskId] ?? item.completed);
    setCompleted((c) => ({ ...c, [item.taskId!]: next }));
    startTransition(async () => {
      try {
        await setTaskCompleted(item.taskId!, next);
      } catch {
        setCompleted((c) => ({ ...c, [item.taskId!]: !next }));
      }
      router.refresh();
    });
  }

  const listProps = { today, completedOverrides: completed, onToggle: toggle };
  const brokenFeeds = feeds.filter((f) => f.error);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Calendar</h1>
        <Button onClick={() => setAdding(selected)}>+ New</Button>
      </div>

      {/* Toolbar: previous / today / next, the period (opens a month picker), and the view switch. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={href(view, stepAnchor(view, anchor, -1))}
            aria-label={`Previous ${view === "agenda" ? "30 days" : view}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-raised text-lg text-text-muted hover:bg-bg-hover hover:text-text"
          >
            ‹
          </Link>
          <Link
            href={href(view, today)}
            className="flex h-9 items-center rounded-full border border-border bg-bg-raised px-3.5 text-sm font-medium text-text hover:bg-bg-hover"
          >
            Today
          </Link>
          <Link
            href={href(view, stepAnchor(view, anchor, 1))}
            aria-label={`Next ${view === "agenda" ? "30 days" : view}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-raised text-lg text-text-muted hover:bg-bg-hover hover:text-text"
          >
            ›
          </Link>
          <MonthPicker view={view} anchor={anchor} label={range.label} />
        </div>
        <div role="tablist" aria-label="Calendar view" className="flex rounded-full border border-border bg-bg-raised p-0.5">
          {CALENDAR_VIEWS.map((v) => (
            <Link
              key={v}
              href={href(v, v === "month" || v === view ? anchor : selected)}
              role="tab"
              aria-selected={v === view}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                v === view ? "bg-accent text-bg" : "text-text-muted hover:text-text"
              }`}
            >
              {VIEW_LABELS[v]}
            </Link>
          ))}
        </div>
      </div>

      <Legend feeds={feeds} />

      {brokenFeeds.length > 0 && (
        <p className="flag">
          <strong className="text-warn">Couldn&apos;t load {brokenFeeds.map((f) => f.name).join(", ")}.</strong>{" "}
          {brokenFeeds[0].error}{" "}
          <Link href="/settings/calendar" className="text-accent hover:underline">
            Check linked calendars
          </Link>
        </p>
      )}

      {view === "month" && (
        <div className="space-y-4">
          <MonthGrid
            from={range.from}
            to={range.to}
            month={parseKey(anchor).month}
            today={today}
            selected={selected}
            byDay={byDay}
            completedOverrides={completed}
            onSelect={setSelected}
          />
          <section aria-label={longDayLabel(selected)} className="space-y-2">
            <DayHeader day={selected} today={today} onAdd={() => setAdding(selected)} />
            <DayItems items={byDay[selected] ?? []} {...listProps} emptyText="Nothing on this day." />
          </section>
        </div>
      )}

      {view === "week" && (
        <div className="space-y-2">
          {daysBetween(range.from, range.to).map((day) => (
            <section
              key={day}
              aria-label={longDayLabel(day)}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]"
            >
              <WeekDayHeader day={day} today={today} onAdd={() => setAdding(day)} />
              <DayItems items={byDay[day] ?? []} {...listProps} emptyText="Nothing" compact />
            </section>
          ))}
        </div>
      )}

      {view === "agenda" && (
        <Agenda days={daysBetween(range.from, range.to)} byDay={byDay} onAdd={setAdding} {...listProps} />
      )}

      <NewCalendarItem
        open={adding !== null}
        day={adding ?? selected}
        today={today}
        people={people}
        onClose={() => setAdding(null)}
      />
    </div>
  );
}

function Legend({ feeds }: { feeds: CalendarFeedStatus[] }) {
  const terms = useTerms();
  const entries: [string, string][] = [
    [terms.checkIns, "var(--accent)"],
    ["Tasks", "var(--fg)"],
    ["Overdue", "var(--urgent)"],
    ["Birthdays", "var(--cal-birthday)"],
    ...feeds.map((f) => [f.name, `var(--cal-ext-${f.color})`] as [string, string]),
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.82rem] text-text-muted">
      {entries.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <Dot color={color} />
          {label}
        </span>
      ))}
      <Link href="/settings/calendar" className="text-accent hover:underline">
        {feeds.length ? "Linked calendars" : "Link Google, Apple or Outlook"}
      </Link>
    </div>
  );
}

function DayHeader({ day, today, onAdd }: { day: string; today: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="section-title text-text">
        {day === today ? "Today" : longDayLabel(day).split(",")[0]}
        <span className="ml-2 text-sm font-normal text-text-muted">{longDayLabel(day).split(", ")[1]}</span>
      </h2>
      <button type="button" onClick={onAdd} className="h-9 rounded-full px-3 text-sm font-semibold text-accent hover:bg-bg-hover">
        + Add
      </button>
    </div>
  );
}

function WeekDayHeader({ day, today, onAdd }: { day: string; today: string; onAdd: () => void }) {
  const { day: n } = parseKey(day);
  const weekday = longDayLabel(day).split(",")[0];
  const isToday = day === today;
  return (
    <div className="flex flex-col items-center gap-0.5 pt-1.5">
      <span className="eyebrow">{weekday.slice(0, 3)}</span>
      <span
        className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-base tabular-nums ${
          isToday ? "bg-accent font-semibold text-bg" : "text-text"
        }`}
      >
        {n}
      </span>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add to ${longDayLabel(day)}`}
        className="h-7 rounded-full px-2.5 text-sm font-semibold text-accent hover:bg-bg-hover"
      >
        +
      </button>
    </div>
  );
}

function DayItems({
  items,
  emptyText,
  compact = false,
  ...listProps
}: {
  items: CalendarItem[];
  emptyText: string;
  compact?: boolean;
  today: string;
  completedOverrides: Record<string, boolean>;
  onToggle: (item: CalendarItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p
        className={`rounded-2xl border border-dashed border-border text-center text-sm text-text-faint ${
          compact ? "px-4 py-5 text-left" : "px-4 py-6"
        }`}
      >
        {emptyText}
      </p>
    );
  }
  return <ItemList items={items} {...listProps} />;
}

function Agenda({
  days,
  byDay,
  onAdd,
  ...listProps
}: {
  days: string[];
  byDay: Record<string, CalendarItem[]>;
  onAdd: (day: string) => void;
  today: string;
  completedOverrides: Record<string, boolean>;
  onToggle: (item: CalendarItem) => void;
}) {
  const withItems = days.filter((d) => (byDay[d]?.length ?? 0) > 0);
  if (withItems.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-text-faint">
        Nothing in the next 30 days.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {withItems.map((day) => (
        <section key={day} aria-label={longDayLabel(day)} className="space-y-2">
          <DayHeader day={day} today={listProps.today} onAdd={() => onAdd(day)} />
          <ItemList items={byDay[day]} {...listProps} />
        </section>
      ))}
    </div>
  );
}

/** The period label; opens a year + month picker to jump anywhere. */
function MonthPicker({ view, anchor, label }: { view: View; anchor: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(parseKey(anchor).year);
  const ref = useRef<HTMLDivElement>(null);
  const current = parseKey(anchor);

  useEffect(() => {
    if (!open) return;
    setYear(parseKey(anchor).year);
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchor]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 items-center gap-1 rounded-full px-2 text-base font-medium text-text hover:bg-bg-hover"
      >
        {label}
        <span aria-hidden className="text-xs text-text-muted">
          ▾
        </span>
      </button>
      {open && (
        <div role="dialog" aria-label="Jump to month" className="card absolute left-0 top-11 z-30 w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              aria-label="Previous year"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover"
            >
              ‹
            </button>
            <span className="font-medium tabular-nums text-text">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              aria-label="Next year"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_NAMES.map((name, i) => {
              const isCurrent = year === current.year && i + 1 === current.month;
              return (
                <Link
                  key={name}
                  href={href(view === "agenda" ? "agenda" : view, makeKey(year, i + 1, 1))}
                  onClick={() => setOpen(false)}
                  className={`rounded-full py-1.5 text-center text-sm ${
                    isCurrent ? "bg-accent text-bg" : "text-text hover:bg-bg-hover"
                  }`}
                >
                  {name.slice(0, 3)}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
