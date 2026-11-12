// Calendar view math and outside-calendar link checks. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, groupByDay, isDayKey, stepAnchor, viewRange, type CalendarItem } from "../lib/calendar-items.ts";
import { normalizeCalendarUrl } from "../lib/calendar-fetch.ts";

test("month view covers whole weeks, Sunday to Saturday", () => {
  // November 2026 starts on a Sunday and ends on a Monday.
  assert.deepEqual(viewRange("month", "2026-11-12"), { from: "2026-11-01", to: "2026-12-05", label: "November 2026" });
  // February 2026 starts on a Sunday and ends on a Saturday: exactly 4 weeks.
  const feb = viewRange("month", "2026-02-10");
  assert.equal(feb.from, "2026-02-01");
  assert.equal(feb.to, "2026-02-28");
});

test("week and agenda ranges and labels", () => {
  assert.deepEqual(viewRange("week", "2026-11-12"), { from: "2026-11-08", to: "2026-11-14", label: "Nov 8 – 14, 2026" });
  assert.equal(viewRange("week", "2026-12-30").label, "Dec 27, 2026 – Jan 2, 2027");
  assert.equal(viewRange("week", "2026-11-30").label, "Nov 29 – Dec 5, 2026");
  const agenda = viewRange("agenda", "2026-11-12");
  assert.equal(agenda.from, "2026-11-12");
  assert.equal(agenda.to, "2026-12-11");
});

test("previous/next steps", () => {
  assert.equal(stepAnchor("month", "2026-01-31", -1), "2025-12-01");
  assert.equal(stepAnchor("month", "2026-01-31", 1), "2026-02-01");
  assert.equal(stepAnchor("week", "2026-11-12", 1), "2026-11-19");
  assert.equal(stepAnchor("agenda", "2026-11-12", -1), "2026-10-13");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
});

test("day keys are validated", () => {
  assert.ok(isDayKey("2028-02-29"));
  assert.ok(!isDayKey("2026-02-29"));
  assert.ok(!isDayKey("2026-13-01"));
  assert.ok(!isDayKey("NaN"));
});

test("items group by day, all-day first then by time", () => {
  const base = { title: "x" } as const;
  const items: CalendarItem[] = [
    { ...base, key: "a", kind: "task", day: "2026-11-12", minutes: 600 },
    { ...base, key: "b", kind: "external", day: "2026-11-12", minutes: 540 },
    { ...base, key: "c", kind: "birthday", day: "2026-11-12", minutes: null },
    { ...base, key: "d", kind: "external", day: "2026-11-13", minutes: 60 },
  ];
  const g = groupByDay(items);
  assert.deepEqual(g["2026-11-12"].map((i) => i.key), ["c", "b", "a"]);
  assert.deepEqual(g["2026-11-13"].map((i) => i.key), ["d"]);
});

test("outside calendar links: https and webcal only, no private hosts", () => {
  assert.equal(
    normalizeCalendarUrl(" webcal://p01-caldav.icloud.com/published/2/abc "),
    "https://p01-caldav.icloud.com/published/2/abc",
  );
  assert.equal(
    normalizeCalendarUrl("https://calendar.google.com/calendar/ical/x%40group/private-y/basic.ics"),
    "https://calendar.google.com/calendar/ical/x%40group/private-y/basic.ics",
  );
  for (const bad of [
    "http://calendar.google.com/x.ics",
    "https://localhost/x.ics",
    "https://127.0.0.1/x.ics",
    "https://[::1]/x.ics",
    "https://169.254.169.254/latest",
    "https://intranet/x.ics",
    "https://user:pw@example.com/x.ics",
    "https://example.com:8443/x.ics",
    "file:///etc/passwd",
    "not a url",
  ]) {
    assert.equal(normalizeCalendarUrl(bad), null, bad);
  }
});
