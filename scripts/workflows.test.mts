import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanWorkflow, matches, taskTitle, WORKFLOW_TEMPLATES, ACTIONS, type WorkflowContext } from "../lib/workflows-shared.ts";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ctx: WorkflowContext = {
  isOrg: true,
  members: [ID(1), ID(2)],
  lists: [ID(10)],
  services: [ID(20)],
  exitReasons: [ID(30)],
  customFields: [
    { id: ID(40), kind: "choice", options: ["Workforce", "Youth"] },
    { id: ID(41), kind: "date", options: [] },
  ],
  forms: [{ id: ID(50), fields: [{ id: "svc0001", type: "checkboxes", options: ["Housing", "Food"] }] }],
};
const solo: WorkflowContext = { ...ctx, isOrg: false, members: [] };

test("a valid rule is accepted and cleaned", () => {
  const wf = cleanWorkflow(
    {
      trigger: { type: "form_submitted", formId: ID(50) },
      conditions: [{ field: "answer:svc0001", op: "contains", value: "housing" }],
      actions: [
        { type: "create_task", title: "  Call {name}  ", dueDays: 2, assignee: ID(1) },
        { type: "add_to_list", listId: ID(10) },
        { type: "assign_response", userId: ID(2) },
      ],
    },
    ctx,
  );
  assert.equal(wf.actions[0].type === "create_task" && wf.actions[0].title, "Call {name}");
  assert.equal(wf.conditions.length, 1);
});

test("ids from another account are refused", () => {
  const other = ID(99);
  assert.throws(() => cleanWorkflow({ trigger: { type: "form_submitted", formId: other }, actions: [{ type: "flag_followup" }] }, ctx));
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: [{ type: "add_to_list", listId: other }] }, ctx));
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: [{ type: "assign_person", userId: other }] }, ctx));
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: [{ type: "create_task", title: "x", assignee: other }] }, ctx));
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, conditions: [{ field: "owner", op: "is", value: other }], actions: [{ type: "flag_followup" }] }, ctx));
});

test("there is no way to send email, delete, change roles or call out", () => {
  for (const type of ["send_email", "send_sms", "delete_person", "change_role", "webhook", "run_script", "set_billing"]) {
    assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: [{ type }] }, ctx), type);
  }
  const types = ACTIONS.map((a) => a.type).join(" ");
  assert.ok(!/email|sms|delete|role|webhook|script|billing/.test(types));
});

test("organization-only and form-only actions are checked", () => {
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: [{ type: "assign_person", userId: ID(1) }] }, solo));
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: [{ type: "set_response_status", status: "processed" }] }, ctx));
});

test("conditions must fit the trigger", () => {
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, conditions: [{ field: "exit_group", op: "is", value: "unplanned" }], actions: [{ type: "flag_followup" }] }, ctx));
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, conditions: [{ field: "email", op: "is", value: "x" }], actions: [{ type: "flag_followup" }] }, ctx));
});

test("numbers are clamped and limits enforced", () => {
  const wf = cleanWorkflow({ trigger: { type: "no_contact", days: 9999 }, actions: [{ type: "create_task", title: "t", dueDays: -4, assignee: "owner" }] }, ctx);
  assert.equal(wf.trigger.type === "no_contact" && wf.trigger.days, 30);
  assert.equal(wf.actions[0].type === "create_task" && wf.actions[0].dueDays, 0);
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: Array(6).fill({ type: "flag_followup" }) }, ctx));
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: [] }, ctx));
});

test("set_field values must fit the field", () => {
  assert.throws(() => cleanWorkflow({ trigger: { type: "person_added" }, actions: [{ type: "set_field", fieldId: ID(40), value: "Seniors" }] }, ctx));
  assert.ok(cleanWorkflow({ trigger: { type: "person_added" }, actions: [{ type: "set_field", fieldId: ID(40), value: "Youth" }] }, ctx));
});

test("conditions evaluate as expected", () => {
  const person = { email: "a@b.co", phone: null, ownerId: ID(1), custom: { [ID(40)]: "Youth" }, listIds: [ID(10)] };
  const c = { person, answers: { svc0001: ["Housing", "Food"] }, exit: { kind: "unplanned", reasonId: ID(30) } };
  assert.ok(matches([], c));
  assert.ok(matches([{ field: "answer:svc0001", op: "contains", value: "hous" }], c));
  assert.ok(matches([{ field: "answer:svc0001", op: "is", value: "food" }], c));
  assert.ok(!matches([{ field: "answer:svc0001", op: "is_not", value: "Food" }], c));
  assert.ok(matches([{ field: "phone", op: "is_empty" }, { field: "email", op: "is_not_empty" }], c));
  assert.ok(matches([{ field: `custom:${ID(40)}`, op: "is", value: "youth" }], c));
  assert.ok(matches([{ field: "list", op: "is", value: ID(10) }, { field: "owner", op: "is_not", value: ID(2) }], c));
  assert.ok(matches([{ field: "exit_group", op: "is", value: "unplanned" }], c));
  assert.ok(!matches([{ field: "exit_group", op: "is", value: "positive" }], c));
});

test("task titles fill in the name", () => {
  assert.equal(taskTitle("Call {name} today", "Ana Ortiz"), "Call Ana Ortiz today");
});

test("every starter is valid once its form is picked", () => {
  for (const t of WORKFLOW_TEMPLATES) {
    const trigger = t.needs === "form" ? { ...t.workflow.trigger, formId: ID(50) } : t.workflow.trigger;
    assert.ok(cleanWorkflow({ ...t.workflow, trigger }, ctx), t.key);
  }
});
