// The email check stays fast on hostile input (ReDoS). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isEmail } from "../lib/email-check.ts";

test("accepts real addresses, rejects junk", () => {
  assert.equal(isEmail("ana@example.org"), true);
  assert.equal(isEmail("a.b+c@sub.example.co"), true);
  assert.equal(isEmail("no-at-sign.example.org"), false);
  assert.equal(isEmail("a@b"), false);
  assert.equal(isEmail(""), false);
});

test("a huge crafted input is rejected instantly", () => {
  const started = Date.now();
  assert.equal(isEmail("a@" + ".".repeat(50_000) + " "), false);
  assert.ok(Date.now() - started < 50, "took too long");
});
