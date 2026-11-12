import { query, queryOne } from "@/lib/db/client";
import { parseIcs } from "@/lib/ical";
import { fetchCalendarText } from "@/lib/calendar-fetch";
import { dayKey, timeParts, zoneOffsetMs } from "@/lib/tz";
import { addDays, daysBetween, makeKey, parseKey, viewRange, type CalendarItem, type ViewRange } from "@/lib/calendar-items";

/**
 * A member's month for the Team view, read-only. Tasks and events from their
 * linked calendars show only as "Busy" with a time: the query never reads a
 * task's title, so a member's to-dos stay private to them. Birthdays of the
 * organization's clients they added keep their names (client records are
 * shared with the organization anyway).
 *
 * Reads outside the viewer's database access rules on purpose (another
 * person's tasks), so it checks first that the member belongs to `orgId`.
 */
export async function memberBusyMonth(
  orgId: string,
  memberId: string,
  anchor: string,
  tz: string,
): Promise<{ items: CalendarItem[]; range: ViewRange }> {
  const range = viewRange("month", anchor);
  const inOrg = await queryOne(`select 1 from memberships where org_id = $1 and user_id = $2`, [orgId, memberId]);
  if (!inOrg) return { items: [], range };

  const start = midnight(range.from, tz);
  const end = midnight(addDays(range.to, 1), tz);
  const [tasks, birthdays, feeds] = await Promise.all([
    query<{ id: string; due_at: string }>(
      `select id, due_at from tasks
        where user_id = $1 and deleted_at is null and not completed and due_at >= $2 and due_at < $3
        order by due_at limit 2000`,
      [memberId, start.toISOString(), end.toISOString()],
    ),
    query<{ id: string; display_name: string; month: number; day: number }>(
      `select id, display_name, extract(month from birthday)::int as month, extract(day from birthday)::int as day
         from people where user_id = $1 and org_id = $2 and deleted_at is null and birthday is not null`,
      [memberId, orgId],
    ),
    query<{ id: string; url: string }>(`select id, url from calendar_feeds where user_id = $1`, [memberId]),
  ]);

  const items: CalendarItem[] = [];
  for (const t of tasks) {
    items.push({ key: `t-${t.id}`, kind: "task", title: "Busy", day: dayKey(t.due_at, tz), minutes: minutesOf(t.due_at, tz) });
  }
  const years = new Set([parseKey(range.from).year, parseKey(range.to).year]);
  for (const b of birthdays) {
    for (const year of years) {
      const key = makeKey(year, b.month, b.day);
      if (key < range.from || key > range.to) continue;
      items.push({ key: `b-${b.id}-${year}`, kind: "birthday", title: b.display_name, day: key, minutes: null, href: `/team/client/${b.id}` });
    }
  }
  await Promise.all(
    feeds.map(async (feed) => {
      try {
        const events = parseIcs(await fetchCalendarText(feed.url), start, end, tz);
        events.forEach((e, i) => {
          const base = { kind: "external" as const, title: "Busy" };
          if (e.allDay && e.startDay && e.endDay) {
            const last = addDays(e.endDay, -1);
            const days = daysBetween(e.startDay > range.from ? e.startDay : range.from, last < range.to ? last : range.to).slice(0, 62);
            for (const day of days) items.push({ ...base, key: `x-${feed.id}-${i}-${day}`, day, minutes: null });
          } else if (e.start) {
            const day = dayKey(e.start, tz);
            if (day < range.from || day > range.to) return;
            const minutes = minutesOf(e.start, tz);
            const length = e.end ? Math.round((e.end.getTime() - e.start.getTime()) / 60_000) : 0;
            items.push({ ...base, key: `x-${feed.id}-${i}`, day, minutes, endMinutes: length > 0 ? minutes + length : null });
          }
        });
      } catch {
        // An unreachable linked calendar just shows nothing here.
      }
    }),
  );
  return { items, range };
}

function midnight(key: string, tz: string): Date {
  const { year, month, day } = parseKey(key);
  const guess = Date.UTC(year, month - 1, day);
  return new Date(guess - zoneOffsetMs(new Date(guess), tz));
}

function minutesOf(at: Date | string, tz: string): number {
  const { hour, minute } = timeParts(at, tz);
  return hour * 60 + minute;
}
