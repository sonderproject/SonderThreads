/** "Mon, Sep 28" for all-day items, "Mon, Sep 28 · 3:00 PM" when a time was set (in the viewer's local time). */
export function formatDue(value: string | Date): string {
  const d = new Date(value);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (d.getHours() === 0 && d.getMinutes() === 0) return date;
  return `${date} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
