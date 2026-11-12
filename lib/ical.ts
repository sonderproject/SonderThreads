import ICAL from "ical.js";
import { isValidTimeZone, zoneOffsetMs } from "./tz.ts";

/**
 * Reading and writing iCalendar (.ics) files: the format every calendar app
 * (Google, Apple, Outlook, Calendly, Cal.com) shares calendars in.
 */

export type IcsOccurrence = {
  uid: string;
  title: string;
  location: string | null;
  allDay: boolean;
  /** All-day: first local day ("YYYY-MM-DD") and the day after the last. */
  startDay?: string;
  endDay?: string;
  /** Timed: exact instants. */
  start?: Date;
  end?: Date;
};

/** Stop expanding a runaway recurrence (e.g. a minutely rule) after this many steps. */
const MAX_STEPS_PER_EVENT = 20000;
const MAX_OCCURRENCES = 2000;

function dayOf(t: InstanceType<typeof ICAL.Time>): string {
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

/**
 * The real instant of a timed value. Times with a known zone (or UTC) convert
 * directly; "floating" times and zones the file didn't define are read as
 * wall-clock time in their named zone when it's a real one, else the viewer's.
 */
function toInstant(t: InstanceType<typeof ICAL.Time>, viewerTz: string): Date {
  const tzid = t.zone?.tzid;
  if (tzid === "UTC" || (tzid && tzid !== "floating" && ICAL.TimezoneService.has(tzid))) return t.toJSDate();
  const named = (t as unknown as { timezone?: string }).timezone;
  const tz = isValidTimeZone(named) ? named : viewerTz;
  const wall = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  return new Date(wall - zoneOffsetMs(new Date(wall), tz));
}

/**
 * Every event occurrence overlapping [from, to), with recurring events
 * expanded and moved/cancelled instances applied. Throws on unreadable files.
 */
export function parseIcs(text: string, from: Date, to: Date, viewerTz: string): IcsOccurrence[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(vtz);
    } catch {
      // A malformed zone just falls back to wall-clock reading.
    }
  }

  const vevents = root.getAllSubcomponents("vevent");
  const exceptions = new Map<string, InstanceType<typeof ICAL.Component>[]>();
  const masters: InstanceType<typeof ICAL.Component>[] = [];
  for (const ve of vevents) {
    if (ve.hasProperty("recurrence-id")) {
      const uid = String(ve.getFirstPropertyValue("uid") ?? "");
      exceptions.set(uid, [...(exceptions.get(uid) ?? []), ve]);
    } else {
      masters.push(ve);
    }
  }

  const out: IcsOccurrence[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const ve of masters) {
    if (out.length >= MAX_OCCURRENCES) break;
    const uid = String(ve.getFirstPropertyValue("uid") ?? "");
    let event: InstanceType<typeof ICAL.Event>;
    try {
      event = new ICAL.Event(ve, { exceptions: exceptions.get(uid) ?? [], strictExceptions: false });
    } catch {
      continue;
    }
    if (!event.startDate) continue;

    const push = (start: InstanceType<typeof ICAL.Time>, end: InstanceType<typeof ICAL.Time> | null, item: InstanceType<typeof ICAL.Event>) => {
      if (String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") return;
      const title = (item.summary || "").trim() || "Busy";
      const location = (item.location || "").trim() || null;
      if (start.isDate) {
        const endT = end && end.compare(start) > 0 ? end : null;
        const startDay = dayOf(start);
        let endDay: string;
        if (endT) endDay = dayOf(endT);
        else {
          const next = start.clone();
          next.adjust(1, 0, 0, 0);
          endDay = dayOf(next);
        }
        // Compare by UTC midnight of the day keys against the window (a day's slack covers time zones).
        const s = Date.UTC(start.year, start.month - 1, start.day) - 86_400_000;
        const e = Date.UTC(Number(endDay.slice(0, 4)), Number(endDay.slice(5, 7)) - 1, Number(endDay.slice(8, 10))) + 86_400_000;
        if (e <= fromMs || s >= toMs) return;
        out.push({ uid, title, location, allDay: true, startDay, endDay });
        return;
      }
      const s = toInstant(start, viewerTz);
      const e = end ? toInstant(end, viewerTz) : s;
      if (e.getTime() < fromMs || s.getTime() >= toMs) return;
      out.push({ uid, title, location, allDay: false, start: s, end: e });
    };

    if (!event.isRecurring()) {
      push(event.startDate, event.endDate, event);
      continue;
    }

    const it = event.iterator();
    for (let step = 0; step < MAX_STEPS_PER_EVENT && out.length < MAX_OCCURRENCES; step++) {
      const next = it.next();
      if (!next) break;
      const d = event.getOccurrenceDetails(next);
      // Recurrences are in order of their original start; stop once past the window (a day's slack).
      if (next.isDate ? Date.UTC(next.year, next.month - 1, next.day) - 86_400_000 >= toMs : toInstant(next, viewerTz).getTime() >= toMs) {
        // A moved instance could land earlier, but those are rare enough to ignore past the window.
        break;
      }
      push(d.startDate, d.endDate, d.item);
    }
  }
  return out;
}

// ── Writing ─────────────────────────────────────────────────────────────

export type IcsOutEvent = {
  uid: string;
  title: string;
  start: Date;
  minutes: number;
  description?: string;
  url?: string;
};

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Lines over 75 octets continue on the next line after a space (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Don't split a multi-byte character.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // continuation lines start with a space
  }
  return parts.join("\r\n ");
}

/** A complete .ics calendar of the given events. */
export function buildIcs(calendarName: string, events: IcsOutEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Strynd//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(new Date(e.start.getTime() + e.minutes * 60_000))}`,
      `SUMMARY:${escapeText(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
