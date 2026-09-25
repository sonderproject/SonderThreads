const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Short forms people actually type. "sat"/"sun" are left out on purpose —
// they're ordinary words ("sat with Marcus").
const WEEKDAY_ALIASES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

/*
 * All arithmetic below happens on a "wall clock" Date whose UTC fields hold
 * the user's local date and time, so results don't depend on the server's
 * time zone (UTC on Vercel). tzOffset uses getTimezoneOffset() semantics:
 * minutes to add to local time to get UTC (e.g. 420 for US Pacific daylight).
 */
type Wall = Date;
const toWall = (real: Date, tzOffset: number): Wall => new Date(real.getTime() - tzOffset * 60_000);
const fromWall = (wall: Wall, tzOffset: number): Date => new Date(wall.getTime() + tzOffset * 60_000);

function dayStart(d: Wall): Wall {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}
function addDays(d: Wall, n: number): Wall {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}
function addMonths(d: Wall, n: number): Wall {
  const c = new Date(d);
  const day = c.getUTCDate();
  c.setUTCDate(1);
  c.setUTCMonth(c.getUTCMonth() + n);
  const last = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 0)).getUTCDate();
  c.setUTCDate(Math.min(day, last));
  return c;
}
function wallDate(y: number, m: number, d: number): Wall | null {
  const c = new Date(Date.UTC(y, m, d));
  return c.getUTCFullYear() === y && c.getUTCMonth() === m && c.getUTCDate() === d ? c : null;
}
/** A month/day with no year means the next time it comes around. */
function upcoming(m: number, d: number, today: Wall): Wall | null {
  const y = today.getUTCFullYear();
  const thisYear = wallDate(y, m, d);
  if (thisYear && thisYear.getTime() >= today.getTime()) return thisYear;
  return wallDate(y + 1, m, d);
}
function fullYear(y: string): number {
  const n = parseInt(y, 10);
  return y.length <= 2 ? 2000 + n : n;
}

type Time = { h: number; m: number };

/** Hours written without am/pm: 1–7 almost always mean the afternoon ("at 3"). */
function guessHour(h: number): number {
  return h >= 1 && h <= 7 ? h + 12 : h;
}

function takeTime(text: string): { time: Time | null; rest: string; relativeMs?: number } {
  let m: RegExpMatchArray | null;

  if ((m = text.match(/\bin\s+(an?|half an|\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i))) {
    const qty = /^an?$/i.test(m[1]) ? 1 : /^half/i.test(m[1]) ? 0.5 : parseFloat(m[1]);
    const unitMs = /^h/i.test(m[2]) ? 3_600_000 : 60_000;
    return { time: null, rest: text.replace(m[0], " "), relativeMs: qty * unitMs };
  }

  if ((m = text.match(/\b(?:at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\s|$|[,.!?])/i))) {
    let h = parseInt(m[1], 10) % 12;
    if (/^p/i.test(m[3])) h += 12;
    return { time: { h, m: m[2] ? parseInt(m[2], 10) : 0 }, rest: text.replace(m[0], " ") };
  }

  if ((m = text.match(/\bat\s+(\d{1,2}):(\d{2})\b/i)) || (m = text.match(/\b(\d{1,2}):(\d{2})\b/))) {
    const raw = parseInt(m[1], 10);
    return { time: { h: raw > 12 ? raw : guessHour(raw), m: parseInt(m[2], 10) }, rest: text.replace(m[0], " ") };
  }

  if ((m = text.match(/\bat\s+(\d{1,2})\b(?!\s*(?:\/|st\b|nd\b|rd\b|th\b|days?|weeks?|months?|hours?|mins?|minutes?))/i))) {
    const raw = parseInt(m[1], 10);
    if (raw <= 23) return { time: { h: raw > 12 ? raw : guessHour(raw), m: 0 }, rest: text.replace(m[0], " ") };
  }

  if ((m = text.match(/\b(?:at\s+)?(noon|midday)\b/i))) return { time: { h: 12, m: 0 }, rest: text.replace(m[0], " ") };
  if ((m = text.match(/\b(end of (?:the )?day|eod)\b/i))) return { time: { h: 17, m: 0 }, rest: text.replace(m[0], " ") };

  const parts: [RegExp, Time][] = [
    [/\b(?:this|in the)\s+morning\b/i, { h: 9, m: 0 }],
    [/\b(?:this|in the)\s+afternoon\b/i, { h: 14, m: 0 }],
    [/\b(?:this|in the)\s+evening\b/i, { h: 18, m: 0 }],
    [/(?<=\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)morning\b/i, { h: 9, m: 0 }],
    [/(?<=\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)afternoon\b/i, { h: 14, m: 0 }],
    [/(?<=\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)(?:evening|night)\b/i, { h: 18, m: 0 }],
  ];
  for (const [re, time] of parts) {
    if ((m = text.match(re))) return { time, rest: text.replace(m[0], " ") };
  }

  return { time: null, rest: text };
}

function takeDate(text: string, today: Wall): { date: Wall | null; rest: string; impliedTime?: Time } {
  let m: RegExpMatchArray | null;
  const out = (date: Wall | null, match: string, impliedTime?: Time) => ({
    date,
    rest: date ? text.replace(match, " ") : text,
    impliedTime,
  });

  if ((m = text.match(/\btonight\b/i))) return out(today, m[0], { h: 20, m: 0 });
  if ((m = text.match(/\b(the )?day after tomorrow\b/i))) return out(addDays(today, 2), m[0]);
  if ((m = text.match(/\btoday\b/i))) return out(today, m[0]);
  if ((m = text.match(/\btomorrow\b/i))) return out(addDays(today, 1), m[0]);

  if ((m = text.match(/\bin\s+(a|an|one|two|three|\d+)\s+(days?|weeks?|months?)\b/i))) {
    const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 };
    const n = words[m[1].toLowerCase()] ?? parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const d = unit.startsWith("day") ? addDays(today, n) : unit.startsWith("week") ? addDays(today, 7 * n) : addMonths(today, n);
    return out(d, m[0]);
  }
  if ((m = text.match(/\bnext week\b/i))) return out(addDays(today, 7), m[0]);
  if ((m = text.match(/\bnext month\b/i))) return out(addMonths(today, 1), m[0]);
  if ((m = text.match(/\b(?:by\s+)?(?:the\s+)?end of (?:the\s+)?month\b/i))) {
    return out(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)), m[0]);
  }
  if ((m = text.match(/\b(?:by\s+)?(?:the\s+)?end of (?:the\s+|this\s+)?week\b/i))) {
    return out(addDays(today, (5 - today.getUTCDay() + 7) % 7), m[0]);
  }

  // "Oct 5", "October 5th, 2027"
  const monthFirst = new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i");
  if ((m = text.match(monthFirst))) {
    const mo = MONTHS[m[1].toLowerCase()];
    const d = parseInt(m[2], 10);
    return out(m[3] ? wallDate(parseInt(m[3], 10), mo, d) : upcoming(mo, d, today), m[0]);
  }
  // "5 Oct", "5th of October"
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b(?:,?\\s+(\\d{4}))?`, "i");
  if ((m = text.match(dayFirst))) {
    const mo = MONTHS[m[2].toLowerCase()];
    const d = parseInt(m[1], 10);
    return out(m[3] ? wallDate(parseInt(m[3], 10), mo, d) : upcoming(mo, d, today), m[0]);
  }
  // "10/5", "10/5/2027", "10/5/27" (US month/day order)
  if ((m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/))) {
    const mo = parseInt(m[1], 10) - 1;
    const d = parseInt(m[2], 10);
    return out(m[3] ? wallDate(fullYear(m[3]), mo, d) : upcoming(mo, d, today), m[0]);
  }
  // "on the 15th"
  if ((m = text.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i))) {
    const d = parseInt(m[1], 10);
    const y = today.getUTCFullYear();
    const mo = today.getUTCMonth();
    const thisMonth = wallDate(y, mo, d);
    const date = thisMonth && thisMonth.getTime() >= today.getTime() ? thisMonth : wallDate(y, mo + 1, d) ?? null;
    return out(date, m[0]);
  }

  // Weekdays: "next friday", "this friday", "friday", "fri"
  const names = Object.keys(WEEKDAY_ALIASES).sort((a, b) => b.length - a.length).join("|");
  if ((m = text.match(new RegExp(`\\b(next\\s+|this\\s+|on\\s+)?(${names})\\b`, "i")))) {
    const target = WEEKDAY_ALIASES[m[2].toLowerCase()];
    const until = (target - today.getUTCDay() + 7) % 7 || 7;
    const isNext = /^next/i.test(m[1] ?? "");
    return out(addDays(today, isNext ? until + 7 : until), m[0]);
  }

  return { date: null, rest: text };
}

function tidy(text: string): string {
  let t = text.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  // Drop prepositions left dangling once the date/time words are removed.
  const dangling = /(?:^|\s)(?:on|at|by|for|this|next|the|due|before)$/i;
  while (dangling.test(t)) t = t.replace(dangling, "").trim();
  return t.replace(/^(?:on|at|by)\s+/i, "").replace(/[,\s]+$/, "").trim();
}

/**
 * Extracts a natural-language date and/or time from free text. Returns the
 * moment as an ISO string plus the text with the reference stripped out.
 *
 * Understands: today, tonight, tomorrow, day after tomorrow, weekdays
 * (this/next), "in 3 days/2 weeks/a month", "in 2 hours", next week/month,
 * end of week/month, "Oct 5", "5th of October", "10/5", "the 15th", and
 * times like "at 3", "3:30pm", "noon", "this evening", "end of day".
 * With a date but no time the result is local midnight (an all-day item);
 * a time alone means today, or tomorrow if that time has already passed.
 */
export function extractDate(
  text: string,
  now: Date = new Date(),
  tzOffset: number = now.getTimezoneOffset(),
): { date: string | null; remaining: string } {
  const wallNow = toWall(now, tzOffset);
  const today = dayStart(wallNow);

  const t = takeTime(text);
  if (t.relativeMs !== undefined) {
    return { date: new Date(now.getTime() + t.relativeMs).toISOString(), remaining: tidy(t.rest) };
  }

  const d = takeDate(t.rest, today);
  const time = t.time ?? d.impliedTime ?? null;

  if (!d.date && !time) return { date: null, remaining: text.trim() };

  let wall: Wall;
  if (d.date) {
    wall = new Date(d.date);
    if (time) wall.setUTCHours(time.h, time.m, 0, 0);
  } else {
    wall = new Date(today);
    wall.setUTCHours(time!.h, time!.m, 0, 0);
    if (wall.getTime() <= wallNow.getTime()) wall = addDays(wall, 1);
  }

  return { date: fromWall(wall, tzOffset).toISOString(), remaining: tidy(d.rest) };
}

/**
 * Pulls a repeat cadence out of free text ("every day", "weekly", "every
 * Monday", "monthly"). "every <weekday>" is rewritten to just the weekday so
 * extractDate() still picks up the first occurrence.
 */
export function extractRecurrence(text: string): {
  recurrence: "daily" | "weekly" | "monthly" | null;
  remaining: string;
} {
  const tidy = (s: string) => s.replace(/\s{2,}/g, " ").trim();

  const everyWeekday = text.match(new RegExp(`\\bevery\\s+(${WEEKDAYS.join("|")})\\b`, "i"));
  if (everyWeekday) {
    return { recurrence: "weekly", remaining: tidy(text.replace(everyWeekday[0], everyWeekday[1])) };
  }

  const patterns: [RegExp, "daily" | "weekly" | "monthly"][] = [
    [/\b(every\s+day|daily)\b/i, "daily"],
    [/\b(every\s+week|weekly)\b/i, "weekly"],
    [/\b(every\s+month|monthly)\b/i, "monthly"],
  ];
  for (const [pattern, recurrence] of patterns) {
    if (pattern.test(text)) return { recurrence, remaining: tidy(text.replace(pattern, "")) };
  }

  return { recurrence: null, remaining: text };
}
