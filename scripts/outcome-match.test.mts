// Command bar: notes that mention an outcome suggest recording it. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchOutcome } from "../lib/outcome-match.ts";

const nonprofit = [
  { id: "job", name: "Got a job" },
  { id: "housing", name: "Found housing" },
  { id: "program", name: "Completed program" },
  { id: "benefits", name: "Enrolled in benefits" },
  { id: "family", name: "Reunited with family" },
];
const business = [
  { id: "regular", name: "Became a regular" },
  { id: "member", name: "Joined membership" },
  { id: "referral", name: "Referred a friend" },
];

const id = (note: string, list = nonprofit) => matchOutcome(note, list)?.id ?? null;

test("matches the obvious wording", () => {
  assert.equal(id("Marcus got the job at Amazon"), "job");
  assert.equal(id("Ana found housing on 5th street"), "housing");
  assert.equal(id("Jo completed the program today"), "program");
  assert.equal(id("Rosa enrolled in benefits"), "benefits");
  assert.equal(id("Reunited with family after 2 years"), "family");
});

test("matches close wording", () => {
  assert.equal(id("Marcus got hired at Target"), "job");
  assert.equal(id("Finished the training course"), "program");
  assert.equal(id("Got approved for SNAP benefits"), "benefits");
  assert.equal(id("Sam joined our membership plan", business), "member");
  assert.equal(id("Became a regular, comes every week", business), "regular");
});

test("no suggestion when only part of it is there", () => {
  assert.equal(id("Marcus has a job interview Friday"), null);
  assert.equal(id("Looking for housing"), null);
  assert.equal(id("Started the program"), null);
  assert.equal(id("Called about benefits"), null);
  assert.equal(id("Haircut and color", business), null);
});
