/**
 * Database test for dashboards and scheduled reports. Runs against a THROWAWAY local Postgres only:
 *   1. Start Postgres, create an empty database, run scripts/db-tests/supabase-stub.sql in it.
 *   2. POSTGRES_URL=postgresql://postgres@localhost:54329/<db> npx tsx --tsconfig tsconfig.json scripts/db-tests/reports.test.ts
 * Synthetic data only. Prints PASS/FAIL per check.
 */
import { query, queryOne } from "@/lib/db/client";
import { asUser } from "@/lib/db/as-user";
import { computeTiles } from "@/lib/dashboard";
import { localNow, runScheduledReports } from "@/lib/reports-run";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
const u = (n: number) => `00000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
const [A1, S1, M1, A2, SOLO] = [1, 2, 3, 4, 5].map(u);

type Mail = { to: string; subject: string; text: string; html?: string; attachments?: { filename: string; content: Buffer }[] };
let outbox: Mail[] = [];
let failSend = false;
const send = async (m: Mail) => {
  if (failSend) throw new Error("smtp down");
  outbox.push(m);
};
const alerts: string[] = [];
const notify = async (userId: string) => {
  alerts.push(userId);
};

async function main() {
  await query(`select 1`);
  for (const [i, id] of [A1, S1, M1, A2, SOLO].entries()) await query(`insert into users (id, email, name, timezone) values ($1, $2, $3, 'UTC')`, [id, `r${i}@t.dev`, `Tester ${i}`]);
  const [o1] = await query<{ id: string }>(`insert into organizations (name, referral_timezone) values ('Harbor House', 'UTC') returning id`);
  const [o2] = await query<{ id: string }>(`insert into organizations (name, referral_timezone) values ('Elsewhere', 'UTC') returning id`);
  for (const [id, org, role] of [[A1, o1.id, "admin"], [S1, o1.id, "supervisor"], [M1, o1.id, "case_manager"], [A2, o2.id, "admin"]])
    await query(`insert into memberships (org_id, user_id, role) values ($1, $2, $3)`, [org, id, role]);
  const [svc] = await query<{ id: string }>(`insert into services (org_id, user_id, name, price_cents) values ($1, $2, 'Job coaching', 5000) returning id`, [o1.id, A1]);
  const [cf] = await query<{ id: string }>(`insert into custom_fields (org_id, user_id, label, kind, options) values ($1, $2, 'Program', 'choice', '{Youth,Adult}') returning id`, [o1.id, A1]);

  const person = async (owner: string, name: string, program?: string, gender?: string) =>
    (
      await query<{ id: string }>(`insert into people (user_id, first_name, display_name, custom_fields, gender) values ($1, $2, $2, $3, $4) returning id`, [
        owner,
        name,
        JSON.stringify(program ? { [cf.id]: program } : {}),
        gender ?? null,
      ])
    )[0].id;
  const zelda = await person(M1, "Zelda Secretname", "Youth", "Female");
  const yan = await person(A1, "Yan Hidden", "Adult", "Male");
  const other = await person(A2, "Otto Elsewhere");
  const solo = await person(SOLO, "Sol Private");
  const visit = (owner: string, pid: string, daysAgo: number, service: string | null = null, cents: number | null = null) =>
    query(`insert into check_ins (user_id, person_id, checked_in_at, reason, service_id, amount_cents) values ($1, $2, now() - make_interval(days => $3), 'Private reason text', $4, $5)`, [
      owner,
      pid,
      daysAgo,
      service,
      cents,
    ]);
  await visit(M1, zelda, 1, svc.id, 5000);
  await visit(M1, zelda, 2, svc.id, 5000);
  await visit(A1, yan, 3);
  await visit(A1, yan, 20); // the period before
  await visit(A2, other, 1);
  await visit(A2, other, 2);
  await visit(SOLO, solo, 1);

  const today = localNow("UTC").day;
  const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const org = { orgId: o1.id, userId: A1 };
  const get = async (scope: { orgId: string | null; userId: string }, f = {}) =>
    Object.fromEntries((await computeTiles(scope, "UTC", from, today, ["visits", "people_served", "revenue", "gender", "top_services"], f)).map((t) => [t.key, t]));

  const t = await get(org);
  check("organization tiles count only that organization", t.visits.value === 3 && t.people_served.value === 2, { v: t.visits.value, p: t.people_served.value });
  check("revenue sums priced visits", t.revenue.value === 10000, t.revenue.value);
  check("breakdowns are counts with labels, never names", JSON.stringify(t).match(/Zelda|Yan|Private reason/) === null, t.gender.parts);
  const byMember = await get(org, { memberId: M1 });
  check("the member filter narrows to their visits", byMember.visits.value === 2, byMember.visits.value);
  const byService = await get(org, { serviceId: svc.id });
  check("the service filter works", byService.visits.value === 2, byService.visits.value);
  const byProgram = await get(org, { program: { fieldId: cf.id, value: "Adult" } });
  check("the program filter works", byProgram.visits.value === 1, byProgram.visits.value);
  const otherMember = await get(org, { memberId: A2 });
  check("filtering by another organization's member finds nothing", otherMember.visits.value === 0);
  const soloT = await get({ orgId: null, userId: SOLO });
  check("a solo account counts only its own", soloT.visits.value === 1, soloT.visits.value);
  const injected = await get(org, { program: { fieldId: "x' or 1=1 --", value: "Adult" } });
  check("a malformed filter is ignored, not run", injected.visits.value === 3, injected.visits.value);

  /* Scheduled reports ------------------------------------------------- */
  const now = localNow("UTC");
  const mk = async (owner: string, orgId: string | null, recipients: string, extra = "") =>
    (
      await query<{ id: string }>(
        `insert into report_schedules (user_id, org_id, name, frequency, weekday, hour, recipients, tiles${extra ? ", attach_pdf" : ""})
         values ($1, $2, 'Weekly numbers', 'weekly', $3, 0, $4, '{visits,people_served,exits}'${extra ? ", true" : ""}) returning id`,
        [owner, orgId, now.weekday, recipients],
      )
    )[0].id;
  const team = await mk(A1, o1.id, "managers");
  await runScheduledReports({ send, notify });
  const to = outbox.map((m) => m.to).sort();
  check("a team report goes to the organization's Admins and Managers only", JSON.stringify(to) === JSON.stringify(["r0@t.dev", "r1@t.dev"]), to);
  check("emails hold counts, never names or free text", outbox.every((m) => !/Zelda|Yan|Otto|Private reason/.test(m.text + m.html)), outbox[0]?.text);
  check("the email shows the numbers", outbox[0]?.text.includes("Check-ins: 3") ?? false, outbox[0]?.text);
  outbox = [];
  await runScheduledReports({ send, notify });
  check("each period is sent once", outbox.length === 0, outbox.length);

  // Solo schedule.
  const soloSched = await mk(SOLO, null, "managers");
  await runScheduledReports({ send, notify });
  check("scheduled reports are Business-only: an individual's schedule doesn't send", outbox.length === 0, outbox.map((m) => m.to));
  outbox = [];
  void soloSched;

  // Failure, one retry, then an alert.
  const flaky = await mk(S1, o1.id, "me");
  failSend = true;
  await runScheduledReports({ send, notify });
  let d = await queryOne<{ status: string; attempts: number }>(`select status, attempts from report_deliveries where schedule_id = $1`, [flaky]);
  check("a failed send is recorded", d?.status === "failed" && d.attempts === 1, d);
  await runScheduledReports({ send, notify });
  d = await queryOne<{ status: string; attempts: number }>(`select status, attempts from report_deliveries where schedule_id = $1`, [flaky]);
  check("it waits a few minutes before retrying", d?.attempts === 1, d);
  await query(`update report_deliveries set updated_at = now() - interval '5 minutes' where schedule_id = $1`, [flaky]);
  await runScheduledReports({ send, notify });
  d = await queryOne<{ status: string; attempts: number }>(`select status, attempts from report_deliveries where schedule_id = $1`, [flaky]);
  check("it retries once, then alerts the owner in the app", d?.attempts === 2 && d.status === "failed" && alerts.includes(S1), { d, alerts });
  await query(`update report_deliveries set updated_at = now() - interval '5 minutes' where schedule_id = $1`, [flaky]);
  await runScheduledReports({ send, notify });
  d = await queryOne<{ status: string; attempts: number }>(`select status, attempts from report_deliveries where schedule_id = $1`, [flaky]);
  check("…and never more than twice", d?.attempts === 2, d);
  failSend = false;

  // The owner loses report access: the schedule pauses itself.
  const demoted = await mk(M1, o1.id, "managers");
  await runScheduledReports({ send, notify });
  const ds = await queryOne<{ enabled: boolean }>(`select enabled from report_schedules where id = $1`, [demoted]);
  check("a Member's schedule doesn't send and is paused", outbox.length === 0 && ds?.enabled === false, { outbox: outbox.length, ds });

  // PDF attachment, without top visitors or free-text reasons.
  const withPdf = await mk(A2, o2.id, "me", "pdf");
  await runScheduledReports({ send, notify });
  const pdfMail = outbox.find((m) => m.to === "r3@t.dev");
  check("a PDF can be attached", Boolean(pdfMail?.attachments?.[0]?.content.subarray(0, 4).toString() === "%PDF"), pdfMail?.attachments?.[0]?.filename);
  outbox = [];
  void withPdf;

  // Daily cap.
  const capped = await mk(A2, o2.id, "me");
  await query(`delete from report_deliveries where schedule_id = $1`, [capped]);
  await query(`insert into report_deliveries (schedule_id, period, status, recipients) values ($1, 'fake', 'sent', 60)`, [withPdf]);
  await runScheduledReports({ send, notify });
  const cd = await queryOne<{ status: string }>(`select status from report_deliveries where schedule_id = $1`, [capped]);
  check("an account stops at 50 emails a day", cd?.status === "skipped" && outbox.length === 0, cd);

  // API access.
  const viaApi = await asUser(A1, (q) => q(`select id from report_schedules`, []));
  check("schedules aren't readable through the API", viaApi.length === 0, viaApi.length);
  void team;

  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
