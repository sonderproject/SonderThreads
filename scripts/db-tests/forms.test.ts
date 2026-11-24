/**
 * Database test for smart forms. Runs against a THROWAWAY local Postgres only, never production:
 *   1. Start Postgres, create an empty database, run scripts/db-tests/supabase-stub.sql in it.
 *   2. POSTGRES_URL=postgresql://postgres@localhost:54329/<db> npx tsx --tsconfig tsconfig.json scripts/db-tests/forms.test.ts
 * Synthetic data only. Prints PASS/FAIL per check.
 */
import { query, queryOne } from "@/lib/db/client";
import { asUser } from "@/lib/db/as-user";
import { acceptSubmission, publicForm, profileOwner, purgeExpiredSubmissions, startStamp, ipHashFor } from "@/lib/forms-intake";
import { formFilter, submissionVisibility } from "@/lib/forms-scope";
import { cleanDefinition, type FormField } from "@/lib/forms-shared";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
const u = (n: number) => `00000000-0000-0000-0000-0000000002${String(n).padStart(2, "0")}`;
const [A1, S1, M1, A2, SOLO] = [1, 2, 3, 4, 5].map(u);

type Sent = { userId: string; title: string; body: string; href: string };
const sent: Sent[] = [];
const notifyFn = async (userId: string, n: { title: string; body: string; href: string }) => {
  sent.push({ userId, title: n.title, body: n.body, href: n.href });
};

let ip = 0;
const submit = (code: string, formId: string, raw: Record<string, unknown>, extra: Partial<{ honeypot: string; stamp: string; ipHash: string }> = {}) =>
  acceptSubmission({
    code,
    raw,
    ipHash: extra.ipHash ?? ipHashFor(`10.0.0.${++ip}`),
    stamp: extra.stamp ?? startStamp(formId, Date.now() - 20_000),
    honeypot: extra.honeypot ?? "",
    notifyFn,
  });

async function makeForm(owner: string, org: string | null, fields: FormField[], settings: Record<string, unknown>, status = "published") {
  const code = `code${Math.random().toString(36).slice(2, 14)}`;
  const [f] = await query<{ id: string }>(
    `insert into forms (user_id, org_id, name, code, status, fields, settings) values ($1, $2, 'Intake', $3, $4, $5, $6) returning id`,
    [owner, org, code, status, JSON.stringify(fields), JSON.stringify(settings)],
  );
  return { id: f.id, code };
}

async function main() {
  await query(`select 1`); // builds the schema
  for (const [i, id] of [A1, S1, M1, A2, SOLO].entries()) await query(`insert into users (id, email, name) values ($1, $2, $3)`, [id, `f${i}@t.dev`, `Tester ${i}`]);
  const [o1] = await query<{ id: string }>(`insert into organizations (name) values ('Harbor House') returning id`);
  const [o2] = await query<{ id: string }>(`insert into organizations (name) values ('Elsewhere') returning id`);
  for (const [id, org, role] of [[A1, o1.id, "admin"], [S1, o1.id, "supervisor"], [M1, o1.id, "case_manager"], [A2, o2.id, "admin"]])
    await query(`insert into memberships (org_id, user_id, role) values ($1, $2, $3)`, [org, id, role]);
  const [cf] = await query<{ id: string }>(
    `insert into custom_fields (org_id, user_id, label, kind, options) values ($1, $2, 'Program', 'choice', '{Workforce,Youth}') returning id`,
    [o1.id, A1],
  );

  const fields = cleanDefinition(
    [
      { id: "fname01", type: "short_text", label: "First name", required: true, mapTo: "first_name" },
      { id: "lname01", type: "short_text", label: "Last name", mapTo: "last_name" },
      { id: "email01", type: "email", label: "Email", mapTo: "email" },
      { id: "phone01", type: "phone", label: "Phone", mapTo: "phone" },
      { id: "prog001", type: "dropdown", label: "Program", options: ["Workforce", "Youth"], mapTo: `custom:${cf.id}` },
      { id: "why0001", type: "long_text", label: "What brings you in?" },
    ],
    { [cf.id]: "choice" },
  );

  // An existing client, for duplicate checks.
  const [existing] = await query<{ id: string }>(
    `insert into people (user_id, first_name, last_name, display_name, email, phone) values ($1, 'Dana', 'Lee', 'Dana Lee', 'dana@example.org', '(555) 010-2000') returning id`,
    [M1],
  );

  /* Review mode ---------------------------------------------------- */
  const review = await makeForm(A1, o1.id, fields, { intake: "review" });
  const r1 = await submit(review.code, review.id, { fname01: "Ana", lname01: "Ortiz", email01: "ana@example.org", why0001: "Looking for work", prog001: "Youth" });
  check("a valid answer is accepted", r1.ok, r1);
  const s1 = await queryOne<{ status: string; person_id: string | null; org_id: string }>(`select status, person_id, org_id from form_submissions where form_id = $1`, [review.id]);
  check("review mode waits for staff, no profile yet", s1?.status === "needs_review" && s1.person_id === null && s1.org_id === o1.id, s1);
  const to = new Set(sent.map((n) => n.userId));
  check("Admins and Managers are notified, Members aren't", to.has(A1) && to.has(S1) && !to.has(M1) && !to.has(A2), [...to]);
  check("notifications never include the answers", sent.every((n) => !/Ana|Ortiz|ana@|work/i.test(`${n.title} ${n.body} ${n.href}`)), sent);

  /* Automatic intake ----------------------------------------------- */
  const auto = await makeForm(A1, o1.id, fields, { intake: "auto" });
  await submit(auto.code, auto.id, { fname01: "Ben", lname01: "Cruz", email01: "ben@example.org", phone01: "555 010 3000", prog001: "Workforce", why0001: "Training" });
  const s2 = await queryOne<{ status: string; person_id: string | null }>(`select status, person_id from form_submissions where form_id = $1`, [auto.id]);
  const ben = s2?.person_id
    ? await queryOne<{ org_id: string; user_id: string; display_name: string; email: string; custom_fields: Record<string, string> }>(
        `select org_id, user_id, display_name, email, custom_fields from people where id = $1`,
        [s2.person_id],
      )
    : null;
  check("auto intake creates the profile when nobody matches", s2?.status === "approved" && ben?.display_name === "Ben Cruz", { s2, ben });
  check("the profile lands in the form's organization", ben?.org_id === o1.id && ben.user_id === A1, ben);
  check("mapped fields fill the profile (email, custom field)", ben?.email === "ben@example.org" && ben.custom_fields[cf.id] === "Workforce", ben);
  const note = await queryOne<{ content: string; org_id: string }>(`select content, org_id from notes where person_id = $1`, [s2?.person_id]);
  check("unmapped answers go in an intake note", Boolean(note?.content.includes("What brings you in?: Training")) && note?.org_id === o1.id, note);

  // Same email as an existing client: flagged, not created, existing profile untouched.
  const before = await queryOne(`select * from people where id = $1`, [existing.id]);
  await submit(auto.code, auto.id, { fname01: "Dana", lname01: "Leigh", email01: "DANA@example.org", phone01: "1-555-010-2000" });
  const s3 = await queryOne<{ status: string; person_id: string | null; duplicate_ids: string[] }>(
    `select status, person_id, duplicate_ids from form_submissions where form_id = $1 order by created_at desc limit 1`,
    [auto.id],
  );
  check("a possible duplicate is flagged for review", s3?.status === "needs_review" && s3.person_id === null && s3.duplicate_ids.includes(existing.id), s3);
  const after = await queryOne(`select * from people where id = $1`, [existing.id]);
  check("the existing profile isn't changed", JSON.stringify(before) === JSON.stringify(after));
  const people = await queryOne<{ n: number }>(`select count(*)::int as n from people where lower(email) = 'dana@example.org'`);
  check("no second Dana was created", people?.n === 1, people);

  /* Spam and abuse ------------------------------------------------- */
  const count = async () => (await queryOne<{ n: number }>(`select count(*)::int as n from form_submissions where form_id = $1`, [review.id]))!.n;
  const n0 = await count();
  const hp = await submit(review.code, review.id, { fname01: "Bot" }, { honeypot: "http://spam.example" });
  check("the spam trap shows thank-you but saves nothing", hp.ok && (await count()) === n0);
  await submit(review.code, review.id, { fname01: "Fast" }, { stamp: startStamp(review.id, Date.now() - 500) });
  check("a form sent back in under 3 seconds is dropped", (await count()) === n0);
  await submit(review.code, review.id, { fname01: "Forged" }, { stamp: `${Date.now() - 60_000}.forgedsignature000000` });
  check("a forged timing stamp is dropped", (await count()) === n0);
  const bad = await submit(review.code, review.id, { email01: "not-an-email" });
  check("invalid answers come back with errors and aren't saved", !bad.ok && bad.reason === "invalid" && Boolean(bad.errors?.fname01) && (await count()) === n0, bad);
  await submit(review.code, review.id, { fname01: "Eve", user_id: A2, org_id: o2.id, status: "approved" });
  const eve = await queryOne<{ answers: Record<string, unknown>; org_id: string; status: string }>(
    `select answers, org_id, status from form_submissions where form_id = $1 order by created_at desc limit 1`,
    [review.id],
  );
  check("extra fields can't set owner, organization or status", eve?.org_id === o1.id && eve.status === "needs_review" && !("user_id" in (eve?.answers ?? {})), eve);

  const net = ipHashFor("203.0.113.9");
  let last: Awaited<ReturnType<typeof submit>> | null = null;
  for (let i = 0; i < 11; i++) last = await submit(review.code, review.id, { fname01: `P${i}` }, { ipHash: net });
  check("one network is limited to 10 an hour", last !== null && !last.ok && last.reason === "busy", last);

  /* Open / closed -------------------------------------------------- */
  const draft = await makeForm(A1, o1.id, fields, {}, "draft");
  check("a draft form has no public page", (await publicForm(draft.code)) === null);
  const paused = await makeForm(A1, o1.id, fields, {}, "paused");
  const pr = await submit(paused.code, paused.id, { fname01: "Zed" });
  check("a paused form takes no answers", !pr.ok && pr.reason === "paused" && (await publicForm(paused.code))?.closed === "paused", pr);
  const past = await makeForm(A1, o1.id, fields, { closesAt: "2020-01-01T00:00:00Z" });
  check("a form past its deadline is closed", (await submit(past.code, past.id, { fname01: "Late" })).ok === false);
  const capped = await makeForm(A1, o1.id, fields, { maxSubmissions: 1 });
  await submit(capped.code, capped.id, { fname01: "One" });
  const full = await submit(capped.code, capped.id, { fname01: "Two" });
  check("a form stops at its limit", !full.ok && full.reason === "full", full);
  await query(`update organizations set suspended_at = now() where id = $1`, [o2.id]);
  const o2form = await makeForm(A2, o2.id, fields, {});
  check("a suspended organization's form is gone", (await publicForm(o2form.code)) === null);
  await query(`update organizations set suspended_at = null where id = $1`, [o2.id]);

  /* Isolation ------------------------------------------------------ */
  const other = await makeForm(A2, o2.id, fields, { intake: "auto" });
  await submit(other.code, other.id, { fname01: "Dana", lname01: "Lee", email01: "dana@example.org" });
  const os = await queryOne<{ status: string; duplicate_ids: string[]; person_id: string }>(
    `select status, duplicate_ids, person_id from form_submissions where form_id = $1`,
    [other.id],
  );
  const op = await queryOne<{ org_id: string }>(`select org_id from people where id = $1`, [os?.person_id]);
  check("duplicates are only checked inside the same organization", os?.duplicate_ids.length === 0 && op?.org_id === o2.id, { os, op });

  const viaApiOther = await asUser(A2, (q) => q(`select id from form_submissions where org_id = $1`, [o1.id]));
  check("another organization can't read submissions", viaApiOther.length === 0, viaApiOther.length);
  const viaApiMember = await asUser(M1, (q) => q(`select id from form_submissions`, []));
  check("a Member can't read the organization's submissions through the API", viaApiMember.length === 0, viaApiMember.length);
  const formsOther = await asUser(A2, (q) => q(`select id from forms where org_id = $1`, [o1.id]));
  check("another organization can't read the forms", formsOther.length === 0, formsOther.length);
  const forgeForm = await asUser(A2, (q) =>
    q(`insert into forms (user_id, org_id, name, code) values ($1, $2, 'x', 'forgedcode1')`, [A2, o1.id]).then(() => false, () => true),
  );
  check("nobody can create a form in another organization", forgeForm);

  // The app's own filters: Members see only what's assigned to them.
  const memberScope = { userId: M1, orgId: o1.id, canManage: false };
  const mf = formFilter(memberScope, "x.");
  const seenByMember = await query(`select x.id from form_submissions x where ${mf.where} and ${submissionVisibility(memberScope, "x.")}`, [mf.param, M1]);
  check("a Member sees no submissions until one is assigned", seenByMember.length === 0, seenByMember.length);
  await query(`update form_submissions set assigned_to = $1 where id = (select id from form_submissions where form_id = $2 limit 1)`, [M1, review.id]);
  const seenAfter = await query(`select x.id from form_submissions x where ${mf.where} and ${submissionVisibility(memberScope, "x.")}`, [mf.param, M1]);
  check("then exactly the assigned one", seenAfter.length === 1, seenAfter.length);
  const ownAdmin = { userId: A1, orgId: o1.id, canManage: true };
  const oa = formFilter(ownAdmin, "x.");
  const seenByAdmin = await query(`select x.id from form_submissions x where ${oa.where} and ${submissionVisibility(ownAdmin, "x.")}`, [oa.param, A1]);
  check("an Admin sees every submission in the organization", seenByAdmin.length > 5, seenByAdmin.length);
  const adminScope = { userId: A2, orgId: o2.id, canManage: true };
  const af = formFilter(adminScope, "x.");
  const crossAdmin = await query(`select x.id from form_submissions x where ${af.where} and x.form_id = $2`, [af.param, review.id]);
  check("another organization's Admin sees none of them", crossAdmin.length === 0, crossAdmin.length);

  // The form's creator leaves: new profiles still land in the organization, with an Admin.
  await query(`update memberships set active = false where user_id = $1`, [S1]);
  const leftForm = await makeForm(S1, o1.id, fields, { intake: "auto" });
  check("profiles never go to a former member", (await profileOwner({ user_id: S1, org_id: o1.id }, null)) === A1);
  await submit(leftForm.code, leftForm.id, { fname01: "Gus", lname01: "Hale" });
  const gus = await queryOne<{ org_id: string; user_id: string }>(`select org_id, user_id from people where first_name = 'Gus'`);
  check("…and land in the organization", gus?.org_id === o1.id && gus.user_id === A1, gus);

  // Solo account.
  const solo = await makeForm(SOLO, null, cleanDefinition([{ id: "nm00001", type: "short_text", label: "Name", required: true, mapTo: "full_name" }]), { intake: "auto" });
  const soloResult = await submit(solo.code, solo.id, { nm00001: "Iris Park" });
  check("forms are Business-only: an individual's form link doesn't work", (await publicForm(solo.code)) === null && !soloResult.ok, soloResult);
  const iris = await queryOne<{ org_id: string | null; user_id: string; last_name: string }>(`select org_id, user_id, last_name from people where first_name = 'Iris'`);
  check("…and nothing is saved from it", iris === null, iris);

  // Audit: organization submissions are logged (who/what, never the answers).
  const audit = await query<{ action: string }>(`select action from audit_log where table_name = 'form_submissions' and org_id = $1`, [o1.id]);
  check("organization submissions are in the audit log", audit.length > 0, audit.length);

  // Retention: responses older than the form's setting are erased; the profile they made stays.
  const kept = await makeForm(A1, o1.id, fields, { intake: "auto", retentionDays: 30 });
  await submit(kept.code, kept.id, { fname01: "Old", lname01: "Timer", email01: "old@example.org" });
  await submit(kept.code, kept.id, { fname01: "New", lname01: "Comer", email01: "new@example.org" });
  await query(`update form_submissions set created_at = now() - interval '40 days' where form_id = $1 and answers->>'fname01' = 'Old'`, [kept.id]);
  await purgeExpiredSubmissions();
  const left = await query<{ answers: Record<string, unknown>; deleted_at: string | null; person_id: string | null }>(
    `select answers, deleted_at, person_id from form_submissions where form_id = $1 order by created_at`,
    [kept.id],
  );
  const oldPerson = await queryOne(`select 1 from people where first_name = 'Old' and deleted_at is null`);
  check(
    "expired responses are erased, newer ones and created profiles stay",
    left[0].deleted_at !== null && Object.keys(left[0].answers).length === 0 && left[1].deleted_at === null && Boolean(oldPerson),
    left,
  );

  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
