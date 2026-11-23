/**
 * Database test for automations. Runs against a THROWAWAY local Postgres only, never production:
 *   1. Start Postgres, create an empty database, run scripts/db-tests/supabase-stub.sql in it.
 *   2. POSTGRES_URL=postgresql://postgres@localhost:54329/<db> npx tsx --tsconfig tsconfig.json scripts/db-tests/workflows.test.ts
 * Synthetic data only. Prints PASS/FAIL per check.
 */
import { query, queryOne } from "@/lib/db/client";
import { asUser } from "@/lib/db/as-user";
import { runWorkflows } from "@/lib/workflows-run";
import { acceptSubmission, ipHashFor, startStamp } from "@/lib/forms-intake";
import { cleanDefinition } from "@/lib/forms-shared";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
const u = (n: number) => `00000000-0000-0000-0000-0000000003${String(n).padStart(2, "0")}`;
const [A1, S1, M1, A2, SOLO] = [1, 2, 3, 4, 5].map(u);

const alerts: { userId: string; title: string; body: string; href: string }[] = [];
const notify = async (userId: string, n: { title: string; body: string; href: string }) => {
  alerts.push({ userId, title: n.title, body: n.body, href: n.href });
};

async function wf(owner: string, org: string | null, name: string, trigger: object, actions: object[], conditions: object[] = []) {
  const [w] = await query<{ id: string }>(
    `insert into workflows (user_id, org_id, name, enabled, enabled_at, trigger, conditions, actions)
     values ($1, $2, $3, true, now() - interval '1 minute', $4, $5, $6) returning id`,
    [owner, org, name, JSON.stringify(trigger), JSON.stringify(conditions), JSON.stringify(actions)],
  );
  return w.id;
}
const person = async (owner: string, first: string, extra = "") =>
  (await query<{ id: string }>(`insert into people (user_id, first_name, display_name${extra ? ", " + extra.split("=")[0] : ""}) values ($1, $2, $2${extra ? ", " + extra.split("=")[1] : ""}) returning id`, [owner, first]))[0].id;
const tasksFor = (pid: string) => query<{ user_id: string; title: string }>(`select user_id, title from tasks where person_id = $1 and deleted_at is null`, [pid]);

async function main() {
  await query(`select 1`);
  for (const [i, id] of [A1, S1, M1, A2, SOLO].entries()) await query(`insert into users (id, email, name) values ($1, $2, $3)`, [id, `w${i}@t.dev`, `Tester ${i}`]);
  const [o1] = await query<{ id: string }>(`insert into organizations (name) values ('Harbor House') returning id`);
  const [o2] = await query<{ id: string }>(`insert into organizations (name) values ('Elsewhere') returning id`);
  for (const [id, org, role] of [[A1, o1.id, "admin"], [S1, o1.id, "supervisor"], [M1, o1.id, "case_manager"], [A2, o2.id, "admin"]])
    await query(`insert into memberships (org_id, user_id, role) values ($1, $2, $3)`, [org, id, role]);

  /* Person added ----------------------------------------------------- */
  const welcome = await wf(A1, o1.id, "Welcome call", { type: "person_added" }, [
    { type: "create_task", title: "Welcome call with {name}", dueDays: 3, assignee: "owner" },
    { type: "flag_followup" },
  ]);
  const ana = await person(M1, "Ana");
  const o2person = await person(A2, "Otto");
  const imported = await person(M1, "Imported", "import_batch=gen_random_uuid()");
  const events = await query<{ person_id: string }>(`select person_id from automation_events`);
  check("adding a person queues an event for the organization's automation", events.some((e) => e.person_id === ana));
  check("no event for an organization without automations, or for imports", !events.some((e) => e.person_id === o2person || e.person_id === imported), events);

  await runWorkflows(notify);
  const t1 = await tasksFor(ana);
  check("the task is created for the person's owner, with their name", t1.length === 1 && t1[0].user_id === M1 && t1[0].title === "Welcome call with Ana", t1);
  const flagged = await queryOne<{ needs_followup: boolean }>(`select needs_followup from people where id = $1`, [ana]);
  check("the person is flagged for follow-up", flagged?.needs_followup === true);
  const run = await queryOne<{ status: string; detail: string }>(`select status, detail from workflow_runs where workflow_id = $1`, [welcome]);
  check("the run is logged without client details", run?.status === "done" && !/Ana/.test(run.detail), run);
  const audit = await query(`select 1 from audit_log where action = 'automation' and person_id = $1`, [ana]);
  check("the audit log records the automation", audit.length === 1, audit.length);
  await query(`update automation_events set processed_at = null`); // even if events were replayed…
  await runWorkflows(notify);
  check("…an automation never runs twice for the same event", (await tasksFor(ana)).length === 1);

  /* Exits with a condition ------------------------------------------ */
  await wf(A1, o1.id, "Unplanned exit", { type: "person_exited" }, [{ type: "notify", to: "managers", message: "An unplanned exit needs a look." }], [
    { field: "exit_group", op: "is", value: "unplanned" },
  ]);
  const [reason] = await query<{ id: string }>(`insert into exit_reasons (org_id, name, kind) values ($1, 'Lost contact', 'unplanned') returning id`, [o1.id]);
  const [good] = await query<{ id: string }>(`insert into exit_reasons (org_id, name, kind) values ($1, 'Found work', 'positive') returning id`, [o1.id]);
  const ben = await person(M1, "Ben");
  const cara = await person(M1, "Cara");
  await query(`insert into person_exits (user_id, person_id, reason_id, kind, exited_on) values ($1, $2, $3, 'positive', current_date)`, [M1, ben, good.id]);
  await query(`insert into person_exits (user_id, person_id, reason_id, kind, exited_on) values ($1, $2, $3, 'unplanned', current_date)`, [M1, cara, reason.id]);
  await query(`update people set exited_on = current_date where id in ($1, $2)`, [ben, cara]);
  alerts.length = 0;
  await runWorkflows(notify);
  const to = new Set(alerts.map((a) => a.userId));
  check("only the unplanned exit alerts Admins and Managers", alerts.length === 2 && to.has(A1) && to.has(S1) && !to.has(M1), alerts);
  check("alerts carry only the fixed message, never the person's name", alerts.every((a) => !/Cara|Ben/.test(`${a.title} ${a.body}`)), alerts);

  /* Form responses ---------------------------------------------------- */
  const fields = cleanDefinition([
    { id: "fname01", type: "short_text", label: "First name", required: true, mapTo: "first_name" },
    { id: "svc0001", type: "checkboxes", label: "Services", options: ["Housing", "Food"] },
  ]);
  const [form] = await query<{ id: string }>(
    `insert into forms (user_id, org_id, name, code, status, fields, settings) values ($1, $2, 'Intake', 'wfFormCode01', 'published', $3, '{"intake":"review"}') returning id`,
    [A1, o1.id, JSON.stringify(fields)],
  );
  const [list] = await query<{ id: string }>(`insert into lists (user_id, name) values ($1, 'Housing') returning id`, [A1]);
  await wf(A1, o1.id, "Housing requests", { type: "form_submitted", formId: form.id }, [
    { type: "assign_response", userId: M1 },
    { type: "set_response_status", status: "processed" },
  ], [{ field: "answer:svc0001", op: "contains", value: "housing" }]);
  const send = (raw: Record<string, unknown>, n: number) =>
    acceptSubmission({ code: "wfFormCode01", raw, ipHash: ipHashFor(`9.9.9.${n}`), stamp: startStamp(form.id, Date.now() - 20_000), honeypot: "", notifyFn: async () => {} });
  await send({ fname01: "Dee", svc0001: ["Housing"] }, 1);
  await send({ fname01: "Eli", svc0001: ["Food"] }, 2);
  await runWorkflows(notify);
  const subs = await query<{ answers: { fname01: string }; assigned_to: string | null; status: string }>(`select answers, assigned_to, status from form_submissions where form_id = $1`, [form.id]);
  const dee = subs.find((s) => s.answers.fname01 === "Dee");
  const eli = subs.find((s) => s.answers.fname01 === "Eli");
  check("a matching response is assigned and its status changed", dee?.assigned_to === M1 && dee.status === "processed", dee);
  check("a response that doesn't match is left alone", eli?.assigned_to === null && eli.status === "needs_review", eli);

  /* Lists ------------------------------------------------------------- */
  await wf(A1, o1.id, "List new people", { type: "person_added" }, [{ type: "add_to_list", listId: list.id }]);
  const dan = await person(M1, "Dan");
  await runWorkflows(notify);
  const onList = await query(`select 1 from list_items where list_id = $1 and person_id = $2`, [list.id, dan]);
  check("a person is added to the rule owner's list", onList.length === 1);

  /* Tampering: a rule that points at another organization ------------- */
  // Written straight into the database (the builder would refuse it): list and member from Harbor House.
  const evil = await wf(A2, o2.id, "Reach across", { type: "person_added" }, [
    { type: "add_to_list", listId: list.id },
    { type: "assign_person", userId: M1 },
    { type: "create_task", title: "x", dueDays: 0, assignee: M1 },
  ]);
  const otto2 = await person(A2, "Ola");
  await runWorkflows(notify);
  const leak = await query(`select 1 from list_items where person_id = $1`, [otto2]);
  const owner = await queryOne<{ user_id: string; org_id: string }>(`select user_id, org_id from people where id = $1`, [otto2]);
  const m1Tasks = await query(`select 1 from tasks where user_id = $1 and person_id = $2`, [M1, otto2]);
  check("a rule can't add to another account's list", leak.length === 0);
  check("a rule can't hand a person to another organization's member", owner?.user_id === A2 && owner.org_id === o2.id, owner);
  check("a rule can't give tasks to another organization's member", m1Tasks.length === 0);
  const evilRun = await queryOne<{ detail: string }>(`select detail from workflow_runs where workflow_id = $1`, [evil]);
  check("…and the run log says why", Boolean(evilRun?.detail.includes("skipped")), evilRun);

  /* Time trigger ------------------------------------------------------ */
  await wf(A1, o1.id, "Gone quiet", { type: "no_contact", days: 30 }, [{ type: "create_task", title: "Check in with {name}", dueDays: 0, assignee: "owner" }]);
  const quiet = await person(M1, "Quinn");
  const quietExited = await person(M1, "Rex");
  await query(`update people set last_activity_at = now() - interval '45 days' where id in ($1, $2)`, [quiet, quietExited]);
  await query(`update people set exited_on = current_date where id = $1`, [quietExited]);
  await runWorkflows(notify);
  await runWorkflows(notify);
  const qt = (await tasksFor(quiet)).filter((t) => t.title.startsWith("Check in"));
  check("a quiet person gets one check-in task, even across runs", qt.length === 1, qt);
  check("exited people are skipped", (await tasksFor(quietExited)).filter((t) => t.title.startsWith("Check in")).length === 0);

  /* Turned on later -------------------------------------------------- */
  const late = await wf(A1, o1.id, "Late", { type: "check_in" }, [{ type: "flag_followup" }]);
  const gia = await person(M1, "Gia");
  await query(`insert into check_ins (user_id, person_id) values ($1, $2)`, [M1, gia]);
  await query(`update workflows set enabled_at = now() + interval '1 minute' where id = $1`, [late]);
  await runWorkflows(notify);
  check("events from before an automation was turned on are ignored", (await query(`select 1 from workflow_runs where workflow_id = $1`, [late])).length === 0);

  /* Daily cap --------------------------------------------------------- */
  const capped = await wf(A1, o1.id, "Capped", { type: "check_in" }, [{ type: "flag_followup" }]);
  await query(
    `insert into workflow_runs (workflow_id, org_id, user_id, ref, status, actions) select $1, $2, $3, 'x' || g, 'done', 0 from generate_series(1, 100) g`,
    [capped, o1.id, A1],
  );
  const hal = await person(M1, "Hal");
  await query(`insert into check_ins (user_id, person_id) values ($1, $2)`, [M1, hal]);
  await runWorkflows(notify);
  const capRun = await queryOne<{ status: string }>(`select status from workflow_runs where workflow_id = $1 and person_id = $2`, [capped, hal]);
  check("an automation stops at 100 runs a day", capRun?.status === "capped", capRun);

  /* Solo accounts ------------------------------------------------------ */
  await wf(SOLO, null, "Solo welcome", { type: "person_added" }, [{ type: "create_task", title: "Say hi to {name}", dueDays: 0, assignee: "owner" }]);
  const soloP = await person(SOLO, "Ivy");
  const orgP = await person(M1, "Jay");
  await runWorkflows(notify);
  check("a solo automation acts on the solo account", (await tasksFor(soloP)).some((t) => t.user_id === SOLO && t.title === "Say hi to Ivy"));
  check("…and never on organization people", !(await tasksFor(orgP)).some((t) => t.title.startsWith("Say hi")));

  /* Supabase API rules ----------------------------------------------- */
  const otherSees = await asUser(A2, (q) => q(`select id from workflows where org_id = $1`, [o1.id]));
  check("another organization can't read the automations", otherSees.length === 0, otherSees.length);
  const runsVia = await asUser(A1, (q) => q(`select id from workflow_runs`, []));
  check("run logs and events aren't readable through the API", runsVia.length === 0, runsVia.length);
  const forge = await asUser(A1, (q) =>
    q(`insert into workflows (user_id, org_id, name, trigger) values ($1, $2, 'x', '{}')`, [A1, o1.id]).then(() => false, () => true),
  );
  check("automations can't be written through the API", forge);

  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
