/**
 * Database test: backups carry exits, outcomes, custom field values and Business setup
 * (forms, responses, automations, report schedules), and restore them safely.
 * THROWAWAY local Postgres only:
 *   POSTGRES_URL=postgresql://postgres@localhost:54329/<db> npx tsx --tsconfig tsconfig.json scripts/db-tests/backup-business.test.ts
 * Synthetic data only. Prints PASS/FAIL per check.
 */
import { query, queryOne } from "@/lib/db/client";
import { buildBackup } from "@/lib/export/backup";
import { parseBackup, restoreInto } from "@/lib/restore-core";
import { cleanDefinition } from "@/lib/forms-shared";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
const u = (n: number) => `00000000-0000-0000-0000-0000000005${String(n).padStart(2, "0")}`;
const [A, N, S] = [1, 2, 3].map(u);

async function main() {
  await query(`select 1`);
  for (const [i, id] of [A, N, S].entries()) await query(`insert into users (id, email) values ($1, $2)`, [id, `b${i}@t.dev`]);
  const [o1] = await query<{ id: string }>(`insert into organizations (name) values ('Old Org') returning id`);
  const [o2] = await query<{ id: string }>(`insert into organizations (name) values ('New Org') returning id`);
  await query(`insert into memberships (org_id, user_id, role) values ($1, $2, 'admin'), ($3, $4, 'admin')`, [o1.id, A, o2.id, N]);

  // The original account's data.
  const [cf] = await query<{ id: string }>(`insert into custom_fields (org_id, user_id, label, kind, options) values ($1, $2, 'Program', 'choice', '{Youth,Adult}') returning id`, [o1.id, A]);
  const [p] = await query<{ id: string }>(`insert into people (user_id, first_name, display_name, custom_fields) values ($1, 'Rae', 'Rae', $2) returning id`, [A, JSON.stringify({ [cf.id]: "Youth" })]);
  const [reason] = await query<{ id: string }>(`insert into exit_reasons (org_id, name, kind) values ($1, 'Found work', 'positive') returning id`, [o1.id]);
  await query(`insert into person_exits (user_id, person_id, reason_id, kind, exited_on) values ($1, $2, $3, 'positive', '2026-11-01')`, [A, p.id, reason.id]);
  await query(`update people set exited_on = '2026-11-01' where id = $1`, [p.id]);
  const [oc] = await query<{ id: string }>(`insert into outcomes (org_id, name) values ($1, 'Got a job') returning id`, [o1.id]);
  await query(`insert into person_outcomes (user_id, person_id, outcome_id, achieved_on) values ($1, $2, $3, '2026-10-20')`, [A, p.id, oc.id]);
  const fields = cleanDefinition(
    [
      { id: "fname01", type: "short_text", label: "First name", required: true, mapTo: "first_name" },
      { id: "prog001", type: "dropdown", label: "Program", options: ["Youth", "Adult"], mapTo: `custom:${cf.id}` },
    ],
    { [cf.id]: "choice" },
  );
  const [form] = await query<{ id: string }>(
    `insert into forms (user_id, org_id, name, code, status, fields, settings) values ($1, $2, 'Intake', 'oldFormCode1', 'published', $3, '{"intake":"review"}') returning id`,
    [A, o1.id, JSON.stringify(fields)],
  );
  await query(`insert into form_submissions (form_id, user_id, org_id, answers, fields, status, person_id) values ($1, $2, $3, $4, $5, 'processed', $6)`, [
    form.id,
    A,
    o1.id,
    JSON.stringify({ fname01: "Rae", prog001: "Youth" }),
    JSON.stringify(fields),
    p.id,
  ]);
  await query(
    `insert into workflows (user_id, org_id, name, enabled, enabled_at, trigger, actions) values ($1, $2, 'New intake', true, now(), $3, '[{"type":"flag_followup"}]')`,
    [A, o1.id, JSON.stringify({ type: "form_submitted", formId: form.id })],
  );
  await query(`insert into report_schedules (user_id, org_id, name, frequency, recipients, attach_pdf, tiles) values ($1, $2, 'Weekly', 'weekly', 'managers', true, '{visits,exits}')`, [A, o1.id]);

  // The downloaded file (exactly what /api/export sends).
  const file = JSON.parse(JSON.stringify({ exported_at: new Date().toISOString(), ...(await buildBackup(A)) }));
  check("the backup holds exits, outcomes and custom field values", file.exits.length === 1 && file.outcomes.length === 1 && file.people[0].custom_fields[cf.id] === "Youth");
  check("…and the Business setup", file.forms.length === 1 && file.form_responses.length === 1 && file.automations.length === 1 && file.report_schedules.length === 1);

  // Restore into a different Business account, which has its own "program" field.
  const [cf2] = await query<{ id: string }>(`insert into custom_fields (org_id, user_id, label, kind, options) values ($1, $2, 'program', 'choice', '{Youth,Adult}') returning id`, [o2.id, N]);
  const added = await restoreInto(N, parseBackup(file));
  check("everything comes across", added.people === 1 && added.exits === 1 && added.outcomes === 1 && added.forms === 1 && added.form_responses === 1 && added.automations === 1 && added.report_schedules === 1, added);
  const rae = await queryOne<{ id: string; org_id: string; exited_on: string | null; custom_fields: Record<string, string> }>(
    `select id, org_id, to_char(exited_on, 'YYYY-MM-DD') as exited_on, custom_fields from people where user_id = $1`,
    [N],
  );
  check("the person lands in the new organization, still exited", rae?.org_id === o2.id && rae.exited_on === "2026-11-01", rae);
  check("custom field values match the new account's field by name", rae?.custom_fields[cf2.id] === "Youth", rae?.custom_fields);
  const r2 = await queryOne<{ name: string; kind: string }>(`select r.name, r.kind from person_exits x join exit_reasons r on r.id = x.reason_id where x.person_id = $1`, [rae?.id]);
  check("the exit keeps its reason and group (reason added to the new account)", r2?.name === "Found work" && r2.kind === "positive", r2);
  const o = await queryOne<{ name: string; org_id: string }>(`select o.name, o.org_id from person_outcomes po join outcomes o on o.id = po.outcome_id where po.person_id = $1`, [rae?.id]);
  check("the outcome comes back under the new account", o?.name === "Got a job" && o.org_id === o2.id, o);
  const f2 = await queryOne<{ id: string; status: string; code: string; org_id: string }>(`select id, status, code, org_id from forms where org_id = $1`, [o2.id]);
  check("the form comes back as a draft with a new link", f2?.status === "draft" && f2.code !== "oldFormCode1" && f2.org_id === o2.id, f2);
  const resp = await queryOne<{ person_id: string; status: string }>(`select person_id, status from form_submissions where form_id = $1`, [f2?.id]);
  check("its response comes back, linked to the restored person", resp?.person_id === rae?.id && resp?.status === "processed", resp);
  const wf = await queryOne<{ enabled: boolean; trigger: { formId: string } }>(`select enabled, trigger from workflows where org_id = $1`, [o2.id]);
  check("the automation comes back off, pointing at the restored form", wf?.enabled === false && wf.trigger.formId === f2?.id, wf);
  const sch = await queryOne<{ enabled: boolean; recipients: string }>(`select enabled, recipients from report_schedules where org_id = $1`, [o2.id]);
  check("the report schedule comes back paused", sch?.enabled === false && sch.recipients === "managers", sch);

  const again = await restoreInto(N, parseBackup(file));
  check("restoring the same file twice adds nothing", Object.values(again).every((n) => n === 0), again);

  // Into an individual account: personal records yes, Business setup no.
  const solo = await restoreInto(S, parseBackup(file));
  check("an individual gets the people, exits and outcomes", solo.people === 1 && solo.exits === 1 && solo.outcomes === 1, solo);
  check("…but no forms, automations or schedules (Business only)", solo.forms === 0 && solo.form_responses === 0 && solo.automations === 0 && solo.report_schedules === 0, solo);
  const soloForms = await queryOne<{ n: number }>(`select count(*)::int as n from forms where user_id = $1`, [S]);
  check("…and nothing Business-only was written", soloForms?.n === 0, soloForms);
  const oldOrgPeople = await queryOne<{ n: number }>(`select count(*)::int as n from people where org_id = $1`, [o1.id]);
  check("the original organization is untouched", oldOrgPeople?.n === 1, oldOrgPeople);

  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
