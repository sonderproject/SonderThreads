import { test } from "node:test";
import assert from "node:assert/strict";
import { enabledProviders, parseContext } from "../lib/oauth.ts";

test("buttons show only for providers switched on", () => {
  delete process.env.AUTH_GOOGLE;
  delete process.env.AUTH_APPLE;
  assert.deepEqual(enabledProviders(), []);
  process.env.AUTH_GOOGLE = "on";
  assert.deepEqual(enabledProviders(), ["google"]);
  process.env.AUTH_APPLE = "1";
  assert.deepEqual(enabledProviders(), ["google", "apple"]);
  process.env.AUTH_GOOGLE = "off";
  assert.deepEqual(enabledProviders(), ["apple"]);
  delete process.env.AUTH_GOOGLE;
  delete process.env.AUTH_APPLE;
});

test("sign-in context cookie is parsed defensively", () => {
  assert.equal(parseContext(undefined), null);
  assert.equal(parseContext("not json"), null);
  assert.equal(parseContext(JSON.stringify({ utm: {} })), null);
  const c = parseContext(JSON.stringify({ next: "/setup/solo/done", utm: { utm_source: "ig", evil: "x", utm_campaign: "y".repeat(200) }, timeZone: "America/Los_Angeles", consent: true, from: "weird" }));
  assert.ok(c);
  assert.equal(c.next, "/setup/solo/done");
  assert.deepEqual(Object.keys(c.utm).sort(), ["utm_campaign", "utm_source"]);
  assert.equal(c.utm.utm_campaign.length, 80);
  assert.equal(c.consent, true);
  assert.equal(c.from, "signup");
  assert.equal(parseContext(JSON.stringify({ next: "/", consent: "yes" }))?.consent, false);
});
