// Command-bar service logging. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchServiceCommand } from "../lib/service-command.ts";

const people = [
  { id: "ana", displayName: "Ana Ortiz", firstName: "Ana" },
  { id: "marcus", displayName: "Marcus Lee", firstName: "Marcus" },
  { id: "jo1", displayName: "Jo Park", firstName: "Jo" },
  { id: "jo2", displayName: "Jo Smith", firstName: "Jo" },
];
const services = [
  { id: "cut", name: "Haircut" },
  { id: "color", name: "Color" },
  { id: "hcolor", name: "Hair color" },
  { id: "cat", name: "Catering" },
];
const m = (s: string) => matchServiceCommand(s, people, services);

test("separator form", () => {
  assert.deepEqual(m("Ana - haircut"), { personId: "ana", serviceId: "cut", amountCents: null, daysAgo: 0 });
  assert.equal(m("Ana Ortiz: haircut")?.personId, "ana");
  assert.equal(m("Marcus, catering")?.serviceId, "cat");
});

test("past-tense verbs, amounts and yesterday", () => {
  assert.deepEqual(m("Marcus bought catering $1,200.50"), { personId: "marcus", serviceId: "cat", amountCents: 120050, daysAgo: 0 });
  assert.deepEqual(m("Ana had a haircut yesterday $45"), { personId: "ana", serviceId: "cut", amountCents: 4500, daysAgo: 1 });
});

test("longest service name wins", () => {
  assert.equal(m("Ana got hair color")?.serviceId, "hcolor");
  assert.equal(m("Ana got color")?.serviceId, "color");
});

test("plans and reminders are left to the normal parser", () => {
  assert.equal(m("Ana needs a haircut tomorrow"), null);
  assert.equal(m("remind me to book Marcus catering"), null);
  assert.equal(m("Marcus will order catering next week"), null);
});

test("needs a known person, a listed service and a separator or verb", () => {
  assert.equal(m("Bob got a haircut"), null);
  assert.equal(m("Ana got a massage"), null);
  assert.equal(m("Ana haircut"), null);
  assert.equal(m("haircut"), null);
});

test("ambiguous first names don't guess", () => {
  assert.equal(m("Jo - haircut"), null);
  assert.equal(m("Jo Park - haircut")?.personId, "jo1");
});
