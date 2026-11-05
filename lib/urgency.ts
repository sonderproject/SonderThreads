/** Shared rules for what gets colored as urgent, attention or new. */

const DAY = 24 * 60 * 60 * 1000;

/** People and notes added within this window are tagged "new". */
export const NEW_WINDOW_MS = 2 * DAY;

export function isNew(createdAt: string | Date, now = Date.now()): boolean {
  return now - new Date(createdAt).getTime() < NEW_WINDOW_MS;
}

/** "overdue" = due before today (local), "today" = due today, else null. */
export function dueState(dueAt: string | Date | null, completed = false, now = new Date()): "overdue" | "today" | null {
  if (!dueAt || completed) return null;
  const due = new Date(dueAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (due.getTime() < startOfToday) return "overdue";
  if (due.getTime() < startOfToday + DAY) return "today";
  return null;
}
