// iCalendar read/write tests. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, parseIcs } from "../lib/ical.ts";

const wrap = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:test", body.trim(), "END:VCALENDAR"].join("\r\n");

const NY_ZONE = `
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE`;

const from = new Date("2026-11-01T00:00:00Z");
const to = new Date("2026-12-01T00:00:00Z");

test("timed event in a defined zone converts to the right instant", () => {
  const ics = wrap(`${NY_ZONE}
BEGIN:VEVENT
UID:a
DTSTART;TZID=America/New_York:20261112T090000
DTEND;TZID=America/New_York:20261112T100000
SUMMARY:Intake\\, Room 2
LOCATION:Office
END:VEVENT`);
  const [e] = parseIcs(ics, from, to, "UTC");
  assert.equal(e.title, "Intake, Room 2");
  assert.equal(e.location, "Office");
  assert.equal(e.allDay, false);
  assert.equal(e.start?.toISOString(), "2026-11-12T14:00:00.000Z");
  assert.equal(e.end?.toISOString(), "2026-11-12T15:00:00.000Z");
});

test("UTC and floating times", () => {
  const ics = wrap(`
BEGIN:VEVENT
UID:u
DTSTART:20261110T150000Z
SUMMARY:UTC
END:VEVENT
BEGIN:VEVENT
UID:f
DTSTART:20261110T090000
SUMMARY:Floating
END:VEVENT`);
  const events = parseIcs(ics, from, to, "America/Chicago");
  assert.equal(events.find((e) => e.uid === "u")?.start?.toISOString(), "2026-11-10T15:00:00.000Z");
  // Floating 9:00 read in the viewer's zone (Chicago, UTC-6 in November).
  assert.equal(events.find((e) => e.uid === "f")?.start?.toISOString(), "2026-11-10T15:00:00.000Z");
});

test("a zone the file doesn't define but is a real IANA zone", () => {
  const ics = wrap(`
BEGIN:VEVENT
UID:z
DTSTART;TZID=America/Los_Angeles:20261110T090000
SUMMARY:LA
END:VEVENT`);
  const [e] = parseIcs(ics, from, to, "UTC");
  assert.equal(e.start?.toISOString(), "2026-11-10T17:00:00.000Z");
});

test("all-day events keep their day", () => {
  const ics = wrap(`
BEGIN:VEVENT
UID:d
DTSTART;VALUE=DATE:20261126
DTEND;VALUE=DATE:20261128
SUMMARY:Office closed
END:VEVENT`);
  const [e] = parseIcs(ics, from, to, "Pacific/Honolulu");
  assert.equal(e.allDay, true);
  assert.equal(e.startDay, "2026-11-26");
  assert.equal(e.endDay, "2026-11-28");
});

test("weekly recurrence expands inside the window, with exceptions applied", () => {
  const ics = wrap(`${NY_ZONE}
BEGIN:VEVENT
UID:w
DTSTART;TZID=America/New_York:20261001T100000
DTEND;TZID=America/New_York:20261001T103000
RRULE:FREQ=WEEKLY;BYDAY=TH
EXDATE;TZID=America/New_York:20261119T100000
SUMMARY:Team sync
END:VEVENT
BEGIN:VEVENT
UID:w
RECURRENCE-ID;TZID=America/New_York:20261112T100000
DTSTART;TZID=America/New_York:20261112T140000
DTEND;TZID=America/New_York:20261112T143000
SUMMARY:Team sync (moved)
END:VEVENT`);
  const events = parseIcs(ics, from, to, "UTC");
  const starts = events.map((e) => e.start?.toISOString());
  // November Thursdays: 5, 12 (moved to 2pm), 19 (skipped), 26.
  assert.deepEqual(starts, ["2026-11-05T15:00:00.000Z", "2026-11-12T19:00:00.000Z", "2026-11-26T15:00:00.000Z"]);
  assert.equal(events[1].title, "Team sync (moved)");
});

test("cancelled events are left out", () => {
  const ics = wrap(`
BEGIN:VEVENT
UID:c
DTSTART:20261110T150000Z
STATUS:CANCELLED
SUMMARY:Gone
END:VEVENT`);
  assert.equal(parseIcs(ics, from, to, "UTC").length, 0);
});

test("written feeds escape text, fold long lines and parse back", () => {
  const title = "Call Marcus; bring forms, ID\\notes " + "x".repeat(120);
  const ics = buildIcs("Surfdesk", [{ uid: "t1@strynd", title, start: new Date("2026-11-12T15:00:00Z"), minutes: 30 }]);
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
  const [e] = parseIcs(ics, from, to, "UTC");
  assert.equal(e.title, title);
  assert.equal(e.end?.toISOString(), "2026-11-12T15:30:00.000Z");
});
