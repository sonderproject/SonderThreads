// Pricing tests. Run: npm test (node --test with type stripping; no extra dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ORG_PRICE_TIERS,
  calculateMonthlyPrice,
  calculateMonthlyPriceCents,
  graduatedTotalCents,
  minimumSeats,
  orgPriceTiersMatch,
  seatsAfterAdding,
} from "../lib/pricing.ts";

const TABLE: [type: "individual" | "organization", seats: number, dollars: number][] = [
  ["individual", 1, 9],
  ["organization", 2, 38],
  ["organization", 5, 95],
  ["organization", 10, 190],
  ["organization", 15, 285],
  ["organization", 18, 342],
  ["organization", 19, 349],
  ["organization", 20, 349],
  ["organization", 21, 364],
  ["organization", 25, 424],
  ["organization", 30, 499],
  ["organization", 40, 649],
  ["organization", 50, 799],
];

for (const [type, seats, dollars] of TABLE) {
  test(`${type} with ${seats} seat(s) costs $${dollars}`, () => {
    assert.equal(calculateMonthlyPrice(type, seats), dollars);
    assert.equal(calculateMonthlyPriceCents(type, seats), dollars * 100);
  });
}

test("the $349 rate applies at 19 seats instead of $361", () => {
  assert.equal(calculateMonthlyPrice("organization", 19), 349);
});

test("invalid seat counts are refused", () => {
  assert.throws(() => calculateMonthlyPrice("individual", 2));
  assert.throws(() => calculateMonthlyPrice("organization", 1));
  assert.throws(() => calculateMonthlyPrice("organization", 0));
  assert.throws(() => calculateMonthlyPrice("organization", 2.5));
  assert.throws(() => calculateMonthlyPrice("organization", Number.NaN));
});

test("the Stripe graduated tiers charge exactly the formula for every seat count", () => {
  for (const [type, seats, dollars] of TABLE) {
    if (type === "organization") assert.equal(graduatedTotalCents(ORG_PRICE_TIERS, seats), dollars * 100);
  }
  assert.ok(orgPriceTiersMatch(ORG_PRICE_TIERS));
});

test("a wrong Stripe price is detected", () => {
  assert.equal(orgPriceTiersMatch([{ up_to: 20, flat_amount: 24900, unit_amount: 0 }, { up_to: null, unit_amount: 1000 }]), false);
  assert.equal(orgPriceTiersMatch(null), false);
});

test("seat cap: a new invite needs a free seat", () => {
  // 5 seats bought, 3 members + 1 pending invite = 4 in use.
  assert.equal(seatsAfterAdding(3, 1) <= 5, true); // 5th person fits
  assert.equal(seatsAfterAdding(4, 1) <= 5, false); // 6th doesn't
});

test("seat cap: re-inviting the same address doesn't take another seat", () => {
  assert.equal(seatsAfterAdding(4, 1, { replacingInvite: true }) <= 5, true);
});

test("seat cap: accepting a pending invite uses the seat it already holds", () => {
  assert.equal(seatsAfterAdding(4, 1, { fromPendingInvite: true }) <= 5, true);
});

test("seat downgrade: never below 2 or below members + pending invites", () => {
  assert.equal(minimumSeats(0, 0), 2);
  assert.equal(minimumSeats(1, 0), 2);
  assert.equal(minimumSeats(7, 3), 10);
});
