// Custom field values. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFieldValue, displayFieldValue } from "../lib/custom-fields-shared.ts";

const f = (kind: "text" | "number" | "date" | "yesno" | "choice", options: string[] = []) => ({ kind, options, label: "Field" });

test("values are checked against the field type", () => {
  assert.equal(cleanFieldValue(f("text"), "  Max  the  dog "), "Max the dog");
  assert.equal(cleanFieldValue(f("text"), "   "), null);
  assert.equal(cleanFieldValue(f("number"), "1,250"), "1250");
  assert.throws(() => cleanFieldValue(f("number"), "lots"));
  assert.equal(cleanFieldValue(f("date"), "2026-12-01"), "2026-12-01");
  assert.throws(() => cleanFieldValue(f("date"), "12/01/2026"));
  assert.equal(cleanFieldValue(f("yesno"), "yes"), "yes");
  assert.throws(() => cleanFieldValue(f("yesno"), "maybe"));
  assert.equal(cleanFieldValue(f("choice", ["Gold", "Silver"]), "Gold"), "Gold");
  assert.throws(() => cleanFieldValue(f("choice", ["Gold", "Silver"]), "Bronze"));
});

test("values display nicely", () => {
  assert.equal(displayFieldValue("yesno", "no"), "No");
  assert.equal(displayFieldValue("date", "2026-12-01"), "Dec 1, 2026");
  assert.equal(displayFieldValue("text", null), "");
});
