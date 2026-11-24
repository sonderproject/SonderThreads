import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSchedule, cleanTiles, duePeriod, previousRange, rangeFor, rangeLabel, change, DEFAULT_TILES } from "../lib/dashboard-shared.ts";

test("preset ranges end today and custom ranges are clamped", () => {
  assert.deepEqual(rangeFor("7d", "2026-11-23"), { key: "7d", from: "2026-11-17", to: "2026-11-23" });
  assert.deepEqual(rangeFor("last_month", "2026-03-10"), { key: "last_month", from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(rangeFor("this_year", "2026-11-23"), { key: "this_year", from: "2026-01-01", to: "2026-11-23" });
  assert.deepEqual(rangeFor("custom", "2026-11-23", "2026-12-30", "2026-11-01"), { key: "custom", from: "2026-11-01", to: "2026-11-23" });
  assert.equal(rangeFor("custom", "2026-11-23", "2010-01-01", "2026-11-23").from, "2024-11-23");
  assert.equal(rangeFor("nonsense", "2026-11-23").key, "30d");
  assert.equal(rangeFor("custom", "2026-11-23", "'; drop", "x").key, "30d");
});

test("the period before has the same length", () => {
  assert.deepEqual(previousRange("2026-11-17", "2026-11-23"), { from: "2026-11-10", to: "2026-11-16" });
});

test("change handles zero", () => {
  assert.equal(change(5, 0), null);
  assert.equal(change(0, 0), 0);
  assert.equal(change(15, 10), 50);
});

test("weekly reports are due once on the chosen day and hour", () => {
  const s = { frequency: "weekly" as const, weekday: 1, monthDay: 1, hour: 8 };
  assert.equal(duePeriod(s, { day: "2026-11-23", weekday: 1, hour: 7 }), null);
  assert.deepEqual(duePeriod(s, { day: "2026-11-23", weekday: 1, hour: 8 }), { period: "w:2026-11-23", from: "2026-11-16", to: "2026-11-22" });
  assert.equal(duePeriod(s, { day: "2026-11-24", weekday: 2, hour: 9 }), null);
});

test("monthly reports cover the month before", () => {
  const s = { frequency: "monthly" as const, weekday: 0, monthDay: 1, hour: 6 };
  assert.deepEqual(duePeriod(s, { day: "2026-03-01", weekday: 0, hour: 6 }), { period: "m:2026-02", from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(duePeriod(s, { day: "2027-01-01", weekday: 5, hour: 23 }), { period: "m:2026-12", from: "2026-12-01", to: "2026-12-31" });
});

test("schedules only go to people inside the account", () => {
  const solo = cleanSchedule({ recipients: "managers", attachPdf: "1", to: "stranger@example.com" }, "individual", false);
  assert.equal(solo.recipients, "me");
  assert.equal(solo.attachPdf, false);
  assert.ok(!("to" in solo));
  const org = cleanSchedule({ recipients: "managers", attachPdf: "1", hour: 99, weekday: -3, monthDay: 31 }, "nonprofit", true);
  assert.equal(org.recipients, "managers");
  assert.equal(org.attachPdf, true);
  assert.equal(org.hour, 8);
  assert.equal(org.weekday, 1);
  assert.equal(org.monthDay, 1);
  assert.equal(cleanSchedule({ recipients: "everyone@example.com" }, "nonprofit", true).recipients, "me");
});

test("tiles are limited to the audience's allowed set", () => {
  assert.deepEqual(cleanTiles(["gender", "revenue", "visits", "visits", "hack"], "business"), ["revenue", "visits"]);
  assert.deepEqual(cleanTiles([], "nonprofit"), DEFAULT_TILES.nonprofit);
});

test("range labels read naturally", () => {
  assert.equal(rangeLabel("2026-11-16", "2026-11-22"), "Nov 16 – 22, 2026");
  assert.equal(rangeLabel("2026-10-25", "2026-11-23"), "Oct 25 – Nov 23, 2026");
  assert.equal(rangeLabel("2025-12-20", "2026-01-05"), "Dec 20, 2025 – Jan 5, 2026");
});
