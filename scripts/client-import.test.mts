// Client list import tests. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRecords,
  cleanEmail,
  cleanPhone,
  detectDateOrder,
  guessMapping,
  hasAmbiguousDates,
  identityKeys,
  mappingProblem,
  parseCsv,
  parseDate,
  splitFullName,
  tidyName,
} from "../lib/client-import.ts";

const TODAY = "2026-11-11";

test("parseCsv handles quotes, BOM, CRLF, semicolons and blank lines", () => {
  assert.deepEqual(parseCsv('﻿Name,Phone\r\n"Garcia, Maria","(619) 555-0142"\r\n\r\n"Say ""hi""",x\r\n'), [
    ["Name", "Phone"],
    ["Garcia, Maria", "(619) 555-0142"],
    ['Say "hi"', "x"],
  ]);
  assert.deepEqual(parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv("a\tb\nline one\t2"), [["a", "b"], ["line one", "2"]]);
  assert.deepEqual(parseCsv('a,b\n"multi\nline",2'), [["a", "b"], ["multi\nline", "2"]]);
});

test("guessMapping reads common headers", () => {
  assert.deepEqual(guessMapping(["First Name", "Last Name", "DOB", "Cell Phone", "E-mail", "Intake Date", "Notes"]), [
    "first_name",
    "last_name",
    "birthday",
    "phone",
    "email",
    "client_since",
    null,
  ]);
  assert.deepEqual(guessMapping(["Client Name", "Date of Birth", "Phone #", "Email Address"]), ["full_name", "birthday", "phone", "email"]);
  assert.deepEqual(guessMapping(["Phone", "Mobile"]), ["phone", null]);
});

test("mappingProblem needs a name and no duplicates", () => {
  assert.match(mappingProblem(["phone", "email"])!, /name/);
  assert.match(mappingProblem(["first_name", "phone", "phone"])!, /Two columns/);
  assert.equal(mappingProblem(["full_name", null]), null);
});

test("names", () => {
  assert.equal(tidyName("MARIA  DE LA CRUZ"), "Maria De La Cruz");
  assert.equal(tidyName("o'brien-smith"), "O'Brien-Smith");
  assert.equal(tidyName("McDonald"), "McDonald");
  assert.equal(tidyName("José"), "José");
  assert.equal(tidyName("JOSÉ ÁLVAREZ"), "José Álvarez");
  assert.deepEqual(splitFullName("Garcia, Maria Elena"), { first: "Maria Elena", last: "Garcia" });
  assert.deepEqual(splitFullName("Maria Elena Garcia"), { first: "Maria", last: "Elena Garcia" });
  assert.deepEqual(splitFullName("Cher"), { first: "Cher", last: null });
});

test("phones", () => {
  assert.equal(cleanPhone("(619) 555-0142"), "6195550142");
  assert.equal(cleanPhone("619.555.0142"), "6195550142");
  assert.equal(cleanPhone("+1 619 555 0142"), "6195550142");
  assert.equal(cleanPhone("1-619-555-0142"), "6195550142");
  assert.equal(cleanPhone("619-555-0142 ext 12"), "6195550142");
  assert.equal(cleanPhone("619-555-0142 x12"), "6195550142");
  assert.equal(cleanPhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(cleanPhone("555-0142"), null); // 7 digits: no area code
  assert.equal(cleanPhone("123-456-7890"), null); // area code can't start with 1
  assert.equal(cleanPhone("N/A"), null);
});

test("emails", () => {
  assert.equal(cleanEmail(" Maria.Garcia@Example.COM "), "maria.garcia@example.com");
  assert.equal(cleanEmail("mailto:a@b.co"), "a@b.co");
  assert.equal(cleanEmail("Maria <maria@example.com>"), "maria@example.com");
  assert.equal(cleanEmail("maria@example"), null);
  assert.equal(cleanEmail("a@b.co, c@d.co"), null);
  assert.equal(cleanEmail("none"), null);
});

test("dates", () => {
  assert.equal(parseDate("1985-03-14", "mdy", TODAY), "1985-03-14");
  assert.equal(parseDate("3/14/1985", "mdy", TODAY), "1985-03-14");
  assert.equal(parseDate("03-04-1985", "mdy", TODAY), "1985-03-04");
  assert.equal(parseDate("03-04-1985", "dmy", TODAY), "1985-04-03");
  assert.equal(parseDate("3/14/85", "mdy", TODAY), "1985-03-14");
  assert.equal(parseDate("3/14/05", "mdy", TODAY), "2005-03-14");
  assert.equal(parseDate("3/14/30", "mdy", TODAY), "1930-03-14"); // 2030 is in the future
  assert.equal(parseDate("Mar 14, 1985", "mdy", TODAY), "1985-03-14");
  assert.equal(parseDate("14 March 1985", "mdy", TODAY), "1985-03-14");
  assert.equal(parseDate("31106", "mdy", TODAY), "1985-02-28"); // Excel date number
  assert.equal(parseDate("1985-03-14 00:00:00", "mdy", TODAY), "1985-03-14");
  assert.equal(parseDate("2/30/1985", "mdy", TODAY), null); // no Feb 30
  assert.equal(parseDate("14/3/1985", "mdy", TODAY), null); // month 14
  assert.equal(parseDate("2030-01-01", "mdy", TODAY), null); // future
  assert.equal(parseDate("1850-01-01", "mdy", TODAY), null);
  assert.equal(parseDate("unknown", "mdy", TODAY), null);
});

test("date order detection", () => {
  assert.equal(detectDateOrder(["03/04/1990", "25/12/1980"]), "dmy");
  assert.equal(detectDateOrder(["03/04/1990", "12/25/1980"]), "mdy");
  assert.equal(detectDateOrder(["03/04/1990"]), null);
  assert.equal(hasAmbiguousDates(["03/04/1990"]), true);
  assert.equal(hasAmbiguousDates(["12/25/1990", "1990-03-04", "05/05/1990"]), false);
});

test("buildRecords: clean values saved, unreadable ones blank and flagged, nameless rows skipped", () => {
  const rows = [
    ["MARIA", "GARCIA", "3/14/1985", "(619) 555-0142", "Maria@Example.com"],
    ["Ana", "", "2/30/1990", "555-0142", "not an email"],
    ["", "", "1/1/1990", "", ""],
    ["", "Lee", "", "", ""],
  ];
  const out = buildRecords(rows, ["first_name", "last_name", "birthday", "phone", "email"], "mdy", TODAY);
  assert.deepEqual(out[0].record, {
    firstName: "Maria",
    lastName: "Garcia",
    displayName: "Maria Garcia",
    birthday: "1985-03-14",
    phone: "6195550142",
    email: "maria@example.com",
    clientSince: null,
  });
  assert.equal(out[0].warnings.length, 0);
  assert.equal(out[1].record!.birthday, null);
  assert.equal(out[1].record!.phone, null);
  assert.equal(out[1].record!.email, null);
  assert.equal(out[1].warnings.length, 3);
  assert.equal(out[2].error, "No name");
  assert.equal(out[2].line, 4);
  assert.equal(out[3].record!.displayName, "Lee");
});

test("buildRecords with a full-name column", () => {
  const out = buildRecords([["Garcia, Maria"]], ["full_name"], "mdy", TODAY);
  assert.equal(out[0].record!.firstName, "Maria");
  assert.equal(out[0].record!.lastName, "Garcia");
});

test("identityKeys match stored phones in either format", () => {
  const a = identityKeys({ displayName: "Maria Garcia", birthday: "1985-03-14", phone: "+16195550142", email: null });
  const b = identityKeys({ displayName: "maria  garcia", birthday: "1985-03-14", phone: "6195550142", email: null });
  assert.deepEqual(a, b);
});
