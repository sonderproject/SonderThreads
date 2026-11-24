import { test } from "node:test";
import assert from "node:assert/strict";
import { navModel, isActive } from "../lib/nav.ts";
import { settingsSectionVisible } from "../lib/plan.ts";

const base = { showImpact: true, showTeam: false, messageCount: null, referralCount: null, showOwner: false, terms: { checkIns: "Meetings", impact: "Insights" } };
const hrefs = (n: ReturnType<typeof navModel>) => [...n.primary, ...n.menu.items].map((i) => i.href);

test("individuals get a short personal organizer, with no Business tools", () => {
  const n = navModel({ ...base, business: false });
  assert.deepEqual(n.primary.map((i) => i.label), ["Home", "People", "Tasks", "Calendar", "Notes", "Insights"]);
  assert.equal(n.menu.label, "More");
  for (const h of ["/forms", "/automations", "/reports", "/messages", "/team", "/referrals"]) assert.ok(!hrefs(n).includes(h), h);
  assert.ok(hrefs(n).includes("/lists") && hrefs(n).includes("/check-ins"));
});

test("Business accounts keep the core bar and get a Workspace menu", () => {
  const n = navModel({ ...base, business: true, showTeam: true, messageCount: 3, referralCount: 2, terms: { checkIns: "Visits", impact: "Insights" } });
  assert.equal(n.primary.length, 6);
  assert.equal(n.menu.label, "Workspace");
  assert.deepEqual(n.menu.items.map((i) => i.href), ["/check-ins", "/lists", "/forms", "/automations", "/messages", "/referrals", "/team"]);
  assert.equal(n.menu.badge, 5);
});

test("Members don't get Insights; Insights also covers the reports tabs", () => {
  assert.ok(!hrefs(navModel({ ...base, business: true, showImpact: false })).includes("/impact"));
  const insights = navModel({ ...base, business: true }).primary.find((i) => i.href === "/impact")!;
  assert.ok(isActive("/reports", insights));
  assert.ok(!isActive("/", { href: "/impact" }));
  assert.ok(isActive("/", { href: "/" }) && !isActive("/people", { href: "/" }));
});

test("settings sections follow the plan", () => {
  assert.equal(settingsSectionVisible("outcomes", false), false);
  assert.equal(settingsSectionVisible("fields", false), false);
  assert.equal(settingsSectionVisible("automations", false), true);
  assert.equal(settingsSectionVisible("outcomes", true), true);
  assert.equal(settingsSectionVisible("automations", true), false);
  assert.equal(settingsSectionVisible("booking", false), true);
  assert.equal(settingsSectionVisible("services", false), true);
});
