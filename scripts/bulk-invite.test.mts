// Bulk invite list parsing. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBulkInvites, parseJoinDomains, roleFromText } from "../lib/bulk-invite.ts";

test("reads a CSV with a header and a role column", () => {
  const r = parseBulkInvites("Email,Role\nana@agency.org,Admin\nbo@agency.org,manager\ncy@agency.org,\n", "case_manager");
  assert.deepEqual(r.rows, [
    { email: "ana@agency.org", role: "admin" },
    { email: "bo@agency.org", role: "supervisor" },
    { email: "cy@agency.org", role: "case_manager" },
  ]);
  assert.equal(r.invalid.length, 0);
});

test("reads a pasted list, several per line, dedupes and lowercases", () => {
  const r = parseBulkInvites("A@x.org, b@x.org; c@x.org\n\nb@x.org\n<d@x.org>", "supervisor");
  assert.deepEqual(r.rows.map((x) => x.email), ["a@x.org", "b@x.org", "c@x.org", "d@x.org"]);
  assert.ok(r.rows.every((x) => x.role === "supervisor"));
  assert.equal(r.duplicates, 1);
});

test("spreadsheet columns: name, email, role in any order", () => {
  const r = parseBulkInvites("Jane Doe\tjane@co.com\tMember\n\"Lee, Sam\",sam@co.com,Admin", "supervisor");
  assert.deepEqual(r.rows, [
    { email: "jane@co.com", role: "case_manager" },
    { email: "sam@co.com", role: "admin" },
  ]);
});

test("flags broken addresses", () => {
  const r = parseBulkInvites("good@x.org\nbad@\n@nope.com", "case_manager");
  assert.equal(r.rows.length, 1);
  assert.equal(r.invalid.length, 2);
});

test("caps at 1000", () => {
  const list = Array.from({ length: 1200 }, (_, i) => `p${i}@x.org`).join("\n");
  assert.equal(parseBulkInvites(list, "case_manager").rows.length, 1000);
});

test("role words", () => {
  assert.equal(roleFromText("Case Manager"), "case_manager");
  assert.equal(roleFromText("SUPERVISOR"), "supervisor");
  assert.equal(roleFromText("Ninja"), null);
});

test("join link domains reject free webmail", () => {
  assert.deepEqual(parseJoinDomains("@Agency.org, county.gov gmail.com bad"), { domains: ["agency.org", "county.gov"], rejected: ["gmail.com", "bad"] });
});
