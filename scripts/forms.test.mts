import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDefinition, cleanSettings, phoneKey, profileFromAnswers, validateSubmission, type FormField } from "../lib/forms-shared.ts";
import { FORM_TEMPLATES, SENSITIVE_TERMS } from "../lib/form-templates.ts";

const fields: FormField[] = cleanDefinition([
  { id: "fname01", type: "short_text", label: "First name", required: true, mapTo: "first_name" },
  { id: "lname01", type: "short_text", label: "Last name", mapTo: "last_name" },
  { id: "email01", type: "email", label: "Email", mapTo: "email" },
  { id: "phone01", type: "phone", label: "Phone", mapTo: "phone" },
  { id: "svc0001", type: "checkboxes", label: "Services", options: ["Housing", "Food"] },
  { id: "agree01", type: "consent", label: "I agree", required: true },
  { id: "head001", type: "heading", label: "About you" },
  { id: "rate001", type: "rating", label: "Rating" },
  { id: "prog001", type: "dropdown", label: "Program", options: ["Workforce", "Youth"], mapTo: "custom:cf1" },
], { cf1: "choice" });

test("a valid submission is accepted and typed", () => {
  const { answers, errors } = validateSubmission(fields, {
    fname01: "  Ana ", lname01: "Ortiz", email01: "ANA@Example.com", phone01: "(555) 010-0101",
    svc0001: ["Housing"], agree01: "on", rate001: "4", prog001: "Workforce", extra: "ignored",
  });
  assert.deepEqual(errors, {});
  assert.equal(answers.fname01, "Ana");
  assert.equal(answers.email01, "ana@example.com");
  assert.deepEqual(answers.svc0001, ["Housing"]);
  assert.equal(answers.rate001, 4);
  assert.equal("extra" in answers, false, "unknown keys are dropped");
  assert.equal("head001" in answers, false, "headings collect nothing");
});

test("required, format and option errors are reported per field", () => {
  const { errors } = validateSubmission(fields, { email01: "not-an-email", svc0001: ["Housing", "Hacked"], rate001: "9", prog001: "Nope" });
  assert.equal(errors.fname01, "Required.");
  assert.ok(errors.email01);
  assert.ok(errors.svc0001);
  assert.ok(errors.rate001);
  assert.ok(errors.prog001);
  assert.ok(errors.agree01, "required consent must be checked");
});

test("overlong text is refused, not silently cut", () => {
  const { errors } = validateSubmission(fields, { fname01: "x".repeat(400), agree01: "on" });
  assert.ok(errors.fname01);
});

test("answers map onto the profile and the rest goes to the note", () => {
  const { answers } = validateSubmission(fields, { fname01: "Ana", lname01: "Ortiz", email01: "a@b.co", svc0001: ["Food"], agree01: "on", prog001: "Youth" });
  const d = profileFromAnswers(fields, answers);
  assert.equal(d.firstName, "Ana");
  assert.equal(d.lastName, "Ortiz");
  assert.equal(d.email, "a@b.co");
  assert.equal(d.custom.cf1, "Youth");
  assert.ok(d.noteLines.includes("Services: Food"));
  assert.ok(d.noteLines.includes("I agree: Agreed"));
});

test("mappings must fit the field type and protected fields can't be targeted", () => {
  assert.throws(() => cleanDefinition([{ type: "long_text", label: "Bio", mapTo: "email" }]));
  assert.throws(() => cleanDefinition([{ type: "short_text", label: "Role", mapTo: "role" }]));
  assert.throws(() => cleanDefinition([{ type: "short_text", label: "Owner", mapTo: "user_id" }]));
  assert.throws(() => cleanDefinition([{ type: "short_text", label: "Org", mapTo: "org_id" }]));
  assert.throws(() => cleanDefinition([{ type: "number", label: "Level", mapTo: "custom:cf1" }], { cf1: "choice" }));
  assert.throws(() =>
    cleanDefinition([
      { type: "email", label: "Email", mapTo: "email" },
      { type: "email", label: "Work email", mapTo: "email" },
    ]),
  );
});

test("unknown field types and empty option lists are refused", () => {
  assert.throws(() => cleanDefinition([{ type: "file_upload", label: "File" }]));
  assert.throws(() => cleanDefinition([{ type: "dropdown", label: "Pick", options: [] }]));
});

test("settings are clamped to safe values", () => {
  const s = cleanSettings({ intake: "delete_everything", maxSubmissions: -5, retentionDays: 1, assignTo: "'; drop table users" });
  assert.equal(s.intake, "review");
  assert.equal(s.maxSubmissions, null);
  assert.equal(s.retentionDays, null);
  assert.equal(s.assignTo, null);
});

test("phone numbers compare by digits", () => {
  assert.equal(phoneKey("+1 (555) 010-0101"), phoneKey("555.010.0101"));
  assert.equal(phoneKey("12"), null);
});

test("every template is valid and asks for nothing highly sensitive", () => {
  for (const t of FORM_TEMPLATES) {
    const def = cleanDefinition(t.fields);
    assert.ok(def.length > 0, t.key);
    for (const f of t.fields) assert.ok(!SENSITIVE_TERMS.test(`${f.label} ${f.description ?? ""}`), `${t.key}: ${f.label}`);
  }
  const keys = FORM_TEMPLATES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
});
