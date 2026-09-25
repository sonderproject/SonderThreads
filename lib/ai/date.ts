const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Extracts a natural-language date/time reference from free text and returns
 * an ISO date string, plus the remaining text with the reference stripped.
 * Supports: today, tomorrow, weekday names (this/next), "in N days", "next week".
 */
export function extractDate(
  text: string,
  now: Date = new Date(),
): { date: string | null; remaining: string } {
  const lower = text.toLowerCase();

  if (/\btoday\b/.test(lower)) {
    return { date: startOfDay(now).toISOString(), remaining: text.replace(/\btoday\b/i, "").trim() };
  }

  if (/\btomorrow\b/.test(lower)) {
    return {
      date: startOfDay(addDays(now, 1)).toISOString(),
      remaining: text.replace(/\btomorrow\b/i, "").trim(),
    };
  }

  const inDaysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDaysMatch) {
    const n = parseInt(inDaysMatch[1], 10);
    return {
      date: startOfDay(addDays(now, n)).toISOString(),
      remaining: text.replace(inDaysMatch[0], "").trim(),
    };
  }

  if (/\bnext week\b/.test(lower)) {
    return {
      date: startOfDay(addDays(now, 7)).toISOString(),
      remaining: text.replace(/\bnext week\b/i, "").trim(),
    };
  }

  for (let i = 0; i < WEEKDAYS.length; i++) {
    const weekday = WEEKDAYS[i];
    const nextPattern = new RegExp(`\\bnext\\s+${weekday}\\b`, "i");
    const plainPattern = new RegExp(`\\b${weekday}\\b`, "i");

    if (nextPattern.test(lower)) {
      const daysUntil = (i - now.getDay() + 7) % 7 || 7;
      return {
        date: startOfDay(addDays(now, daysUntil + 7)).toISOString(),
        remaining: text.replace(nextPattern, "").trim(),
      };
    }

    if (plainPattern.test(lower)) {
      const daysUntil = (i - now.getDay() + 7) % 7 || 7;
      return {
        date: startOfDay(addDays(now, daysUntil)).toISOString(),
        remaining: text.replace(plainPattern, "").trim(),
      };
    }
  }

  return { date: null, remaining: text };
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
