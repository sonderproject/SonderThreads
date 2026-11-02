/** Date -> "YYYY-MM-DDTHH:mm" in the browser's local time, for <input type="datetime-local">. */
export function toLocalInputValue(value: string | Date): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local value (local time) -> ISO string, or null if empty/invalid. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatCheckInTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatCheckInDay(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Local calendar-day key ("YYYY-MM-DD") for grouping and date-range filters. */
export function localDayKey(value: string | Date): string {
  return toLocalInputValue(value).slice(0, 10);
}
