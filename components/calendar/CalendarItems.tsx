"use client";

import Link from "next/link";
import { useTerms } from "@/components/TermsProvider";
import { formatMinutes, type CalendarItem } from "@/lib/calendar-items";

/** The token color that marks an item's kind (and overdue state for tasks). */
export function itemColor(item: CalendarItem, today: string): string {
  switch (item.kind) {
    case "meeting":
      return "var(--accent)";
    case "birthday":
      return "var(--cal-birthday)";
    case "external":
      return `var(--cal-ext-${item.color ?? 1})`;
    case "task":
      return isOverdue(item, today) ? "var(--urgent)" : "var(--fg)";
  }
}

export function isOverdue(item: CalendarItem, today: string): boolean {
  return item.kind === "task" && !item.completed && item.day < today;
}

export function Dot({ color, className = "h-2 w-2" }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: color }} />;
}

function timeLabel(item: CalendarItem): string {
  if (item.minutes === null) return "All day";
  const start = formatMinutes(item.minutes);
  if (item.endMinutes && item.endMinutes > item.minutes && item.endMinutes < 24 * 60) {
    return `${start} – ${formatMinutes(item.endMinutes)}`;
  }
  return start;
}

/** One line in a day's list: checkbox (tasks) or color dot, title, and when/what it is. */
export function ItemRow({
  item,
  today,
  completed,
  onToggle,
}: {
  item: CalendarItem;
  today: string;
  /** Task completion as shown (may be ahead of the server while saving). */
  completed?: boolean;
  onToggle?: (item: CalendarItem) => void;
}) {
  const terms = useTerms();
  const done = item.kind === "task" && (completed ?? item.completed);
  const overdue = isOverdue({ ...item, completed: done }, today);
  const kindLabel =
    item.kind === "meeting"
      ? terms.checkIn
      : item.kind === "birthday"
        ? "Birthday"
        : item.kind === "external"
          ? item.source
          : overdue
            ? "Overdue"
            : "Task";
  const meta = [item.kind === "birthday" ? null : timeLabel(item), kindLabel, item.detail].filter(Boolean).join(" · ");
  const title = item.kind === "birthday" ? `${item.title}'s birthday` : item.title;

  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-3 px-3.5 py-2.5">
      {item.kind === "task" && onToggle ? (
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(item)}
          aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
          className="mt-[3px] h-[18px] w-[18px] accent-[var(--accent)]"
        />
      ) : (
        <span className="flex h-6 items-center justify-center">
          <Dot color={itemColor(item, today)} className="h-2.5 w-2.5" />
        </span>
      )}
      <div className="min-w-0">
        {item.href ? (
          <Link
            href={item.href}
            className={`block truncate hover:underline ${done ? "text-text-faint line-through" : "text-text"}`}
          >
            {title}
          </Link>
        ) : (
          <span className="block truncate text-text">{title}</span>
        )}
        <span className={`block truncate text-[0.82rem] ${overdue ? "text-urgent" : "text-text-muted"}`}>{meta}</span>
      </div>
    </li>
  );
}

export function ItemList({
  items,
  today,
  completedOverrides,
  onToggle,
}: {
  items: CalendarItem[];
  today: string;
  completedOverrides: Record<string, boolean>;
  onToggle: (item: CalendarItem) => void;
}) {
  return (
    <ul className="card divide-y divide-border-subtle overflow-hidden p-0">
      {items.map((item) => (
        <ItemRow
          key={item.key}
          item={item}
          today={today}
          completed={item.taskId ? (completedOverrides[item.taskId] ?? item.completed) : undefined}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}
