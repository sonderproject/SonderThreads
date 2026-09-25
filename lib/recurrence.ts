import type { TaskRecurrence } from "@/lib/types";

export const RECURRENCE_OPTIONS: { value: TaskRecurrence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function advance(date: Date, recurrence: TaskRecurrence): Date {
  const next = new Date(date);
  if (recurrence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else {
    // Clamp to the last day of the target month (Jan 31 → Feb 28, not Mar 3).
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  }
  return next;
}

/**
 * Due date for the next occurrence of a recurring task. Steps forward from
 * the current due date (or now, if it had none) until it lands in the
 * future, so completing a task that's weeks overdue doesn't spawn another
 * one that's already overdue.
 */
export function nextDueDate(dueAt: string | Date | null, recurrence: TaskRecurrence, now = new Date()): Date {
  let next = advance(dueAt ? new Date(dueAt) : now, recurrence);
  while (next.getTime() <= now.getTime()) next = advance(next, recurrence);
  return next;
}
