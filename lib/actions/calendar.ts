"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { assertCanWrite } from "@/lib/billing";
import { getTimeZone } from "@/lib/timezone";
import { dayKey, timeParts, zoneOffsetMs } from "@/lib/tz";
import { appUrl } from "@/lib/email";
import { parseIcs, type IcsOccurrence } from "@/lib/ical";
import { CalendarFetchError, fetchCalendarText, normalizeCalendarUrl } from "@/lib/calendar-fetch";
import { toActionResult, type ActionResult } from "@/lib/validation";
import {
  addDays,
  daysBetween,
  isDayKey,
  makeKey,
  parseKey,
  viewRange,
  type CalendarFeedStatus,
  type CalendarItem,
  type CalendarView,
} from "@/lib/calendar-items";
import type { Task } from "@/lib/types";

export type CalendarBirthday = { personId: string; displayName: string; day: number };

/** Everything to render a single month of the calendar: tasks due that month, plus recurring person birthdays that fall in it. */
export async function getCalendarMonth(
  year: number,
  month: number,
  /** Viewer's zone, so a task due late on the 31st doesn't land in next month. */
  timeZone = "UTC",
): Promise<{ tasks: Task[]; birthdays: CalendarBirthday[] }> {
  const userId = await requireUserId();
  const tasks = await query<Task>(
    `select * from tasks
     where user_id = $1
       and deleted_at is null
       and due_at is not null
       and extract(year from due_at at time zone $4) = $2
       and extract(month from due_at at time zone $4) = $3
     order by due_at asc`,
    [userId, year, month, timeZone],
  );

  const birthdayRows = await query<{ id: string; display_name: string; day: number }>(
    `select id, display_name, extract(day from birthday)::int as day
     from people
     where user_id = $1
       and deleted_at is null
       and birthday is not null
       and extract(month from birthday) = $2
     order by day asc`,
    [userId, month],
  );

  return {
    tasks,
    birthdays: birthdayRows.map((r) => ({ personId: r.id, displayName: r.display_name, day: r.day })),
  };
}

// ── The full calendar ──────────────────────────────────────────────────

/** The instant local midnight begins on `key` in `tz`. */
function midnight(key: string, tz: string): Date {
  const { year, month, day } = parseKey(key);
  const guess = Date.UTC(year, month - 1, day);
  return new Date(guess - zoneOffsetMs(new Date(guess), tz));
}

function minutesOf(at: Date | string, tz: string): number {
  const { hour, minute } = timeParts(at, tz);
  return hour * 60 + minute;
}

/** Outside calendars fetched in the last few minutes, per server instance, so flipping views doesn't refetch. */
const feedCache = new Map<string, { at: number; text: string }>();
const FEED_CACHE_MS = 5 * 60_000;

async function feedText(url: string, fresh = false): Promise<string> {
  const hit = feedCache.get(url);
  if (!fresh && hit && Date.now() - hit.at < FEED_CACHE_MS) return hit.text;
  const text = await fetchCalendarText(url);
  feedCache.set(url, { at: Date.now(), text });
  if (feedCache.size > 200) feedCache.delete(feedCache.keys().next().value!);
  return text;
}

type FeedRow = { id: string; name: string; url: string; color: number; last_error: string | null; last_synced_at: string | null };

function externalItems(feed: FeedRow, events: IcsOccurrence[], from: string, to: string, tz: string): CalendarItem[] {
  const out: CalendarItem[] = [];
  events.forEach((e, i) => {
    const base = { kind: "external" as const, title: e.title, source: feed.name, color: feed.color, detail: e.location };
    if (e.allDay && e.startDay && e.endDay) {
      const last = addDays(e.endDay, -1);
      const days = daysBetween(e.startDay > from ? e.startDay : from, last < to ? last : to).slice(0, 62);
      for (const day of days) out.push({ ...base, key: `x-${feed.id}-${i}-${day}`, day, minutes: null });
    } else if (e.start) {
      const day = dayKey(e.start, tz);
      if (day < from || day > to) return;
      const minutes = minutesOf(e.start, tz);
      const length = e.end ? Math.round((e.end.getTime() - e.start.getTime()) / 60_000) : 0;
      out.push({ ...base, key: `x-${feed.id}-${i}`, day, minutes, endMinutes: length > 0 ? minutes + length : null });
    }
  });
  return out;
}

/**
 * Everything on the calendar for one view: your tasks, your logged
 * meetings/check-ins, birthdays, and events from linked outside calendars.
 */
export async function getCalendarRange(
  view: CalendarView,
  anchor: string,
): Promise<{ items: CalendarItem[]; feeds: CalendarFeedStatus[]; today: string; timeZone: string }> {
  const userId = await requireUserId();
  const tz = await getTimeZone();
  const today = dayKey(new Date(), tz);
  const range = viewRange(view, isDayKey(anchor) ? anchor : today);
  const start = midnight(range.from, tz);
  const end = midnight(addDays(range.to, 1), tz);

  const [tasks, checkIns, birthdays, feeds] = await Promise.all([
    query<Pick<Task, "id" | "title" | "due_at" | "completed">>(
      `select id, title, due_at, completed from tasks
       where user_id = $1 and deleted_at is null and due_at >= $2 and due_at < $3
       order by due_at asc limit 2000`,
      [userId, start.toISOString(), end.toISOString()],
    ),
    query<{ id: string; person_id: string; checked_in_at: string; reason: string | null; display_name: string }>(
      `select c.id, c.person_id, c.checked_in_at, c.reason, p.display_name
       from check_ins c join people p on p.id = c.person_id and p.deleted_at is null
       where c.user_id = $1 and c.deleted_at is null and c.checked_in_at >= $2 and c.checked_in_at < $3
       order by c.checked_in_at asc limit 2000`,
      [userId, start.toISOString(), end.toISOString()],
    ),
    query<{ id: string; display_name: string; month: number; day: number }>(
      `select id, display_name, extract(month from birthday)::int as month, extract(day from birthday)::int as day
       from people where user_id = $1 and deleted_at is null and birthday is not null`,
      [userId],
    ),
    query<FeedRow>(
      `select id, name, url, color, last_error, last_synced_at from calendar_feeds where user_id = $1 order by created_at`,
      [userId],
    ),
  ]);

  const items: CalendarItem[] = [];

  for (const t of tasks) {
    if (!t.due_at) continue;
    items.push({
      key: `t-${t.id}`,
      kind: "task",
      title: t.title,
      day: dayKey(t.due_at, tz),
      minutes: minutesOf(t.due_at, tz),
      href: `/tasks#${t.id}`,
      taskId: t.id,
      completed: t.completed,
    });
  }

  for (const c of checkIns) {
    items.push({
      key: `m-${c.id}`,
      kind: "meeting",
      title: c.display_name,
      day: dayKey(c.checked_in_at, tz),
      minutes: minutesOf(c.checked_in_at, tz),
      href: `/people/${c.person_id}`,
      detail: c.reason,
    });
  }

  const years = new Set([parseKey(range.from).year, parseKey(range.to).year]);
  for (const b of birthdays) {
    for (const year of years) {
      const key = makeKey(year, b.month, b.day);
      if (!isDayKey(key) || key < range.from || key > range.to) continue;
      items.push({ key: `b-${b.id}-${year}`, kind: "birthday", title: b.display_name, day: key, minutes: null, href: `/people/${b.id}` });
    }
  }

  const statuses = await Promise.all(
    feeds.map(async (feed): Promise<CalendarFeedStatus> => {
      let error: string | null = null;
      try {
        const text = await feedText(feed.url);
        items.push(...externalItems(feed, parseIcs(text, start, end, tz), range.from, range.to, tz));
      } catch (err) {
        error = err instanceof CalendarFetchError ? err.message : "Couldn't read that calendar.";
      }
      // Record the outcome only when it changed (or hourly), not on every page view.
      const stale = !feed.last_synced_at || Date.now() - Date.parse(feed.last_synced_at) > 3_600_000;
      if (error !== feed.last_error || (!error && stale)) {
        await query(
          `update calendar_feeds set last_error = $3, last_synced_at = case when $3::text is null then now() else last_synced_at end
           where id = $1 and user_id = $2`,
          [feed.id, userId, error],
        ).catch(() => undefined);
      }
      return { id: feed.id, name: feed.name, color: feed.color, error };
    }),
  );

  return { items, feeds: statuses, today, timeZone: tz };
}

// ── Linked outside calendars (Settings → Calendar) ──────────────────────

export type LinkedCalendar = {
  id: string;
  name: string;
  host: string;
  color: number;
  lastError: string | null;
  lastSyncedAt: string | null;
};

const MAX_FEEDS = 10;

export async function listLinkedCalendars(): Promise<LinkedCalendar[]> {
  const userId = await requireUserId();
  const rows = await query<FeedRow>(
    `select id, name, url, color, last_error, last_synced_at from calendar_feeds where user_id = $1 order by created_at`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    // The full link is a secret (anyone with it can read the calendar), so only the host is sent to the page.
    host: (() => {
      try {
        return new URL(r.url).hostname;
      } catch {
        return "";
      }
    })(),
    color: r.color,
    lastError: r.last_error,
    lastSyncedAt: r.last_synced_at,
  }));
}

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!n) throw new Error("Give the calendar a name.");
  return n;
}

function cleanColor(color: number): number {
  return Number.isInteger(color) && color >= 1 && color <= 4 ? color : 1;
}

/** Links an outside calendar after checking its link really returns a readable calendar. */
export async function addLinkedCalendar(params: { name: string; url: string; color: number }): Promise<ActionResult<LinkedCalendar>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const name = cleanName(params.name);
    const url = normalizeCalendarUrl(params.url);
    if (!url) throw new Error("Paste the calendar's private link. It starts with https:// or webcal://.");
    const count = await queryOne<{ n: number }>(`select count(*)::int as n from calendar_feeds where user_id = $1`, [userId]);
    if ((count?.n ?? 0) >= MAX_FEEDS) throw new Error(`You can link up to ${MAX_FEEDS} calendars.`);
    const dupe = await queryOne(`select 1 from calendar_feeds where user_id = $1 and url = $2`, [userId, url]);
    if (dupe) throw new Error("That calendar is already linked.");

    const text = await feedText(url, true);
    try {
      parseIcs(text, new Date(), new Date(Date.now() + 86_400_000), "UTC");
    } catch {
      throw new Error("That link isn't a calendar Strynd can read. Use the private iCal / .ics address.");
    }

    const row = await queryOne<FeedRow>(
      `insert into calendar_feeds (user_id, name, url, color, last_synced_at) values ($1, $2, $3, $4, now())
       returning id, name, url, color, last_error, last_synced_at`,
      [userId, name, url, cleanColor(params.color)],
    );
    if (!row) throw new Error("Couldn't link that calendar.");
    revalidatePath("/calendar");
    return { id: row.id, name: row.name, host: new URL(row.url).hostname, color: row.color, lastError: null, lastSyncedAt: row.last_synced_at };
  });
}

export async function updateLinkedCalendar(id: string, params: { name: string; color: number }): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await query(`update calendar_feeds set name = $3, color = $4 where id = $1 and user_id = $2`, [
      id,
      userId,
      cleanName(params.name),
      cleanColor(params.color),
    ]);
    revalidatePath("/calendar");
    return null;
  });
}

export async function removeLinkedCalendar(id: string): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await query(`delete from calendar_feeds where id = $1 and user_id = $2`, [id, userId]);
    revalidatePath("/calendar");
    return null;
  });
}

// ── Your Strynd calendar, to subscribe to from Google/Apple/Outlook ─────

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function feedUrl(token: string): string {
  return `${appUrl()}/api/calendar/feed/${token}.ics`;
}

/** Your private subscribe link, created the first time it's asked for. */
export async function getMyCalendarLink(): Promise<string> {
  const userId = await requireUserId();
  const row = await queryOne<{ calendar_feed_token: string }>(
    `insert into user_settings (user_id, calendar_feed_token) values ($1, $2)
     on conflict (user_id) do update set calendar_feed_token = coalesce(user_settings.calendar_feed_token, excluded.calendar_feed_token)
     returning calendar_feed_token`,
    [userId, newToken()],
  );
  if (!row) throw new Error("Couldn't create your calendar link.");
  return feedUrl(row.calendar_feed_token);
}

/** Replaces the link, so any copy of the old one stops working. */
export async function resetMyCalendarLink(): Promise<ActionResult<string>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    const row = await queryOne<{ calendar_feed_token: string }>(
      `insert into user_settings (user_id, calendar_feed_token) values ($1, $2)
       on conflict (user_id) do update set calendar_feed_token = excluded.calendar_feed_token
       returning calendar_feed_token`,
      [userId, newToken()],
    );
    if (!row) throw new Error("Couldn't reset your calendar link.");
    return feedUrl(row.calendar_feed_token);
  });
}
