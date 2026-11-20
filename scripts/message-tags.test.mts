// Team message tags (lib/message-tags.ts). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeTrigger, editTextOf, encodeTags, parseBody, previewOf, tagIds } from "../lib/message-tags.ts";

const ANNA = "11111111-1111-4111-8111-111111111111";
const ANN = "22222222-2222-4222-8222-222222222222";
const SAM = "33333333-3333-4333-8333-333333333333";

test("encodes picked tags, longest names first so 'Ann' doesn't eat 'Anna Lee'", () => {
  const body = encodeTags("Call #Anna Lee and #Ann today, @Sam", [
    { kind: "client", id: ANN, name: "Ann" },
    { kind: "client", id: ANNA, name: "Anna Lee" },
    { kind: "user", id: SAM, name: "Sam" },
  ]);
  assert.equal(body, `Call <#${ANNA}> and <#${ANN}> today, <@${SAM}>`);
  const ids = tagIds(body);
  assert.deepEqual([...ids.clients].sort(), [ANNA, ANN].sort());
  assert.deepEqual([...ids.users], [SAM]);
});

test("a reader only sees names of clients they're allowed to see", () => {
  const body = `See <#${ANNA}> and <#${ANN}>, cc <@${SAM}>.`;
  const segs = parseBody(body, new Map([[ANNA, "Anna Lee"]]), new Map([[SAM, "Sam"]]));
  assert.deepEqual(segs, [
    { t: "text", v: "See " },
    { t: "client", id: ANNA, name: "Anna Lee" },
    { t: "text", v: " and " },
    { t: "client", id: null, name: "a client" },
    { t: "text", v: ", cc " },
    { t: "user", id: SAM, name: "Sam" },
    { t: "text", v: "." },
  ]);
  // The hidden client's id never reaches that reader, not even in the edit text.
  assert.equal(editTextOf(segs), "See #Anna Lee and a client, cc @Sam.");
  assert.ok(!JSON.stringify(segs).includes(ANN));
});

test("edit text round-trips back to the same stored body", () => {
  const body = `Hi <@${SAM}>, <#${ANNA}> called`;
  const segs = parseBody(body, new Map([[ANNA, "Anna Lee"]]), new Map([[SAM, "Sam"]]));
  const again = encodeTags(editTextOf(segs), [
    { kind: "user", id: SAM, name: "Sam" },
    { kind: "client", id: ANNA, name: "Anna Lee" },
  ]);
  assert.equal(again, body);
});

test("plain text, look-alike tags and uppercase ids", () => {
  assert.deepEqual(parseBody("no tags <#not-an-id> here", new Map(), new Map()), [{ t: "text", v: "no tags <#not-an-id> here" }]);
  const upper = `<#${ANNA.toUpperCase()}>`;
  assert.deepEqual(parseBody(upper, new Map([[ANNA, "Anna Lee"]]), new Map()), [{ t: "client", id: ANNA, name: "Anna Lee" }]);
});

test("finds the # or @ being typed", () => {
  assert.deepEqual(activeTrigger("hello #an", 9), { kind: "client", start: 6, q: "an" });
  assert.deepEqual(activeTrigger("@", 1), { kind: "user", start: 0, q: "" });
  assert.equal(activeTrigger("email me@work.com", 17), null);
  assert.equal(activeTrigger("#done and more", 14), null);
});

test("inbox previews hide tagged names", () => {
  assert.equal(previewOf(`Call <#${ANNA}> with <@${SAM}>`), "Call #client with @teammate");
});
