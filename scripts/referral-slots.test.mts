// Referral appointment slot tests. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HOURS, cleanHours, formatSlot, generateSlots, localToUtc, periodKeys, planSlots } from "../lib/referral-slots.ts";

const TZ = "America/Los_Angeles";
// Monday Nov 16, 2026, 8:00 AM Pacific (16:00 UTC).
const MON_8AM = new Date("2026-11-16T16:00:00Z");

const slotsFrom = (now: Date, days = 7) => generateSlots({ hours: DEFAULT_HOURS, slotMinutes: 30, tz: TZ, now, days });

test("default hours: Mon–Fri 10am–1pm in 30-minute slots = 6 a day", () => {
  const slots = slotsFrom(MON_8AM, 7); // Mon..Sun
  assert.equal(slots.length, 30); // 5 weekdays × 6
  assert.equal(formatSlot(slots[0], TZ), "Mon, Nov 16 · 10:00 AM");
  assert.equal(formatSlot(slots[5], TZ), "Mon, Nov 16 · 12:30 PM");
  assert.equal(formatSlot(slots[29], TZ), "Fri, Nov 20 · 12:30 PM");
});

test("no weekend slots by default", () => {
  for (const s of slotsFrom(MON_8AM, 14)) {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(s);
    assert.ok(!["Sat", "Sun"].includes(wd), wd);
  }
});

test("slots too soon (under 1 hour away) are skipped", () => {
  const at1015 = new Date("2026-11-16T18:15:00Z"); // 10:15 AM Pacific
  const first = slotsFrom(at1015, 1)[0];
  assert.equal(formatSlot(first, TZ), "Mon, Nov 16 · 11:30 AM");
});

test("local time converts correctly across daylight saving", () => {
  assert.equal(localToUtc(2026, 7, 1, 10 * 60, TZ).toISOString(), "2026-07-01T17:00:00.000Z"); // PDT
  assert.equal(localToUtc(2026, 12, 1, 10 * 60, TZ).toISOString(), "2026-12-01T18:00:00.000Z"); // PST
});

test("booked slots disappear", () => {
  const slots = slotsFrom(MON_8AM, 1);
  const plan = planSlots({ slots, booked: [slots[0], slots[2]], caps: { day: null, week: null, month: null }, tz: TZ });
  assert.equal(plan.open.length, 4);
  assert.equal(plan.pushedByLimits, false);
});

test("a daily limit pushes the client to the next open day", () => {
  const slots = slotsFrom(MON_8AM, 7);
  const booked = slots.slice(0, 3); // 3 booked Monday
  const plan = planSlots({ slots, booked, caps: { day: 3, week: null, month: null }, tz: TZ });
  assert.equal(formatSlot(plan.open[0], TZ), "Tue, Nov 17 · 10:00 AM");
  assert.equal(plan.pushedByLimits, true);
  assert.equal(plan.fullPeriod, "day");
});

test("a weekly limit pushes the client to next week", () => {
  const slots = slotsFrom(MON_8AM, 14);
  const booked = [slots[0], slots[6]]; // Mon + Tue this week
  const plan = planSlots({ slots, booked, caps: { day: null, week: 2, month: null }, tz: TZ });
  assert.equal(formatSlot(plan.open[0], TZ), "Mon, Nov 23 · 10:00 AM");
  assert.equal(plan.fullPeriod, "week");
});

test("a monthly limit can leave no openings (waitlist)", () => {
  const slots = slotsFrom(MON_8AM, 10);
  const plan = planSlots({ slots, booked: [slots[0]], caps: { day: null, week: null, month: 1 }, tz: TZ });
  assert.equal(plan.open.length, 0);
  assert.equal(plan.fullPeriod, "month");
});

test("weeks run Monday to Sunday", () => {
  assert.equal(periodKeys(new Date("2026-11-22T20:00:00Z"), TZ).week, "2026-11-16"); // Sunday
  assert.equal(periodKeys(new Date("2026-11-23T20:00:00Z"), TZ).week, "2026-11-23"); // Monday
});

test("bad hours are dropped", () => {
  assert.deepEqual(cleanHours({ "1": [["13:00", "10:00"]], "9": [["10:00", "11:00"]], "2": [["09:00", "12:00"]] }), {
    "2": [["09:00", "12:00"]],
  });
});
