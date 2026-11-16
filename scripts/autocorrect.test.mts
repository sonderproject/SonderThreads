// Autocorrect word list. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { correctWord, correctionBefore } from "../lib/autocorrect.ts";

test("fixes common typos and keeps capitalization", () => {
  assert.equal(correctWord("teh"), "the");
  assert.equal(correctWord("Teh"), "The");
  assert.equal(correctWord("TEH"), "THE");
  assert.equal(correctWord("dont"), "don't");
  assert.equal(correctWord("i"), "I");
  assert.equal(correctWord("tommorow"), "tomorrow");
});

test("leaves real words, names and links alone", () => {
  assert.equal(correctWord("the"), null);
  assert.equal(correctWord("Maria"), null);
  assert.equal(correctWord("clients"), null);
  assert.equal(correctWord("b2b"), null);
});

test("only corrects the word just finished", () => {
  assert.deepEqual(correctionBefore("call teh ", 9), { start: 5, end: 8, word: "teh", fix: "the" });
  assert.equal(correctionBefore("call teh", 8), null); // still typing
  assert.equal(correctionBefore("see www.teh.com ", 16), null); // part of a link
  assert.equal(correctionBefore("mail bob@teh ", 13), null); // part of an email
  assert.deepEqual(correctionBefore("Ok, dont.", 9)?.fix, "don't");
});
