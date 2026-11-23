import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_EXIT_REASONS, isExitKind, kindShares } from "../lib/exit-kinds.ts";

test("shares always add up to 100", () => {
  for (const c of [
    { positive: 20, neutral: 5, unplanned: 3 },
    { positive: 1, neutral: 1, unplanned: 1 },
    { positive: 2, neutral: 1, unplanned: 0 },
    { positive: 7, neutral: 0, unplanned: 0 },
  ]) {
    const s = kindShares(c);
    assert.equal(s.positive + s.neutral + s.unplanned, 100, JSON.stringify(c));
  }
});

test("no exits means 0% each, not NaN", () => {
  assert.deepEqual(kindShares({ positive: 0, neutral: 0, unplanned: 0 }), { positive: 0, neutral: 0, unplanned: 0 });
});

test("a group with no exits gets 0%", () => {
  assert.equal(kindShares({ positive: 3, neutral: 0, unplanned: 1 }).neutral, 0);
});

test("every default reason has a valid group and a unique name", () => {
  for (const list of Object.values(DEFAULT_EXIT_REASONS)) {
    const names = list.map(([n]) => n.toLowerCase());
    assert.equal(new Set(names).size, names.length);
    for (const [, kind] of list) assert.ok(isExitKind(kind));
  }
});

test("nonprofit defaults include the exits funders ask about", () => {
  const names = DEFAULT_EXIT_REASONS.nonprofit.map(([n]) => n);
  for (const n of ["Got a job", "Found permanent housing", "Received rental assistance", "Moved in with family or friends"]) assert.ok(names.includes(n), n);
});
