/**
 * Database test. Runs against a THROWAWAY local Postgres only, never production:
 *   1. Start Postgres and create an empty database, then (for Supabase-like
 *      roles) run scripts/db-tests/supabase-stub.sql in it.
 *   2. POSTGRES_URL=postgresql://postgres@localhost:54329/st npx tsx --tsconfig tsconfig.json scripts/db-tests/<file>.ts
 * The app builds its schema on first query. Prints PASS/FAIL per check.
 */
import { query, queryOne } from "@/lib/db/client";
import { asUser } from "@/lib/db/as-user";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
const u = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
const [A1, S1, C1, C2, A2, D1, U] = [1, 2, 3, 4, 5, 6, 7].map(u);
const names = (rows: { display_name?: string; content?: string; title?: string }[]) =>
  rows.map((r) => r.display_name ?? r.content ?? r.title).sort();
async function fails(fn: () => Promise<unknown>) { try { await fn(); return false; } catch { return true; } }

async function main() {
  await query(`select 1`); // builds the schema
  const ids = [A1, S1, C1, C2, A2, D1, U];
  for (const [i, id] of ids.entries()) await query(`insert into users (id, email, name) values ($1, $2, $3)`, [id, `u${i}@t.dev`, `User ${i}`]);
  const [o1] = await query<{ id: string }>(`insert into organizations (name) values ('Hope House') returning id`);
  const [o2] = await query<{ id: string }>(`insert into organizations (name) values ('Other Agency') returning id`);
  for (const [id, org, role] of [[A1, o1.id, "admin"], [S1, o1.id, "supervisor"], [C1, o1.id, "case_manager"], [C2, o1.id, "case_manager"], [A2, o2.id, "admin"], [D1, o2.id, "case_manager"]])
    await query(`insert into memberships (org_id, user_id, role) values ($1, $2, $3)`, [org, id, role]);

  // Data, created the normal way (the app's privileged connection).
  const person = async (owner: string, name: string) => (await query<{ id: string; org_id: string | null }>(`insert into people (user_id, first_name, display_name) values ($1, $2, $2) returning id, org_id`, [owner, name]))[0];
  const P1 = await person(C1, "Maria (C1 client)");
  const P2 = await person(C2, "Jo (C2 client)");
  const Q1 = await person(D1, "Sam (other agency)");
  const UP = await person(U, "Friend (solo)");
  check("new clients join the creator's organization", P1.org_id === o1.id && Q1.org_id === o2.id && UP.org_id === null, { P1, Q1, UP });
  await query(`insert into notes (user_id, person_id, content) values ($1, $2, 'note on Maria')`, [C1, P1.id]);
  await query(`insert into notes (user_id, content) values ($1, 'C1 personal note')`, [C1]);
  await query(`insert into tasks (user_id, person_id, title) values ($1, $2, 'call Maria')`, [C1, P1.id]);
  await query(`insert into tasks (user_id, title) values ($1, 'C1 dentist')`, [C1]);
  await query(`insert into check_ins (user_id, person_id) values ($1, $2)`, [C1, P1.id]);
  await query(`insert into lists (user_id, name) values ($1, 'C1 groceries')`, [C1]);
  await query(`insert into notes (user_id, person_id, content) values ($1, $2, 'note on Sam')`, [D1, Q1.id]);
  const orgNote = await queryOne<{ org_id: string | null }>(`select org_id from notes where content = 'note on Maria'`);
  const personalNote = await queryOne<{ org_id: string | null }>(`select org_id from notes where content = 'C1 personal note'`);
  check("a client's note inherits the organization; a personal note doesn't", orgNote?.org_id === o1.id && personalNote?.org_id === null);

  const see = (who: string, sql: string) => asUser(who, (q) => q<{ display_name?: string; content?: string; title?: string }>(sql));

  check("case manager sees only their own clients", JSON.stringify(names(await see(C1, "select display_name from people"))) === JSON.stringify(["Maria (C1 client)"]), names(await see(C1, "select display_name from people")));
  check("case manager sees their personal notes", names(await see(C1, "select content from notes")).includes("C1 personal note"));
  check("supervisor sees every client in their organization", JSON.stringify(names(await see(S1, "select display_name from people"))) === JSON.stringify(["Jo (C2 client)", "Maria (C1 client)"]), names(await see(S1, "select display_name from people")));
  check("supervisor sees client notes and tasks", JSON.stringify(names(await see(S1, "select content from notes"))) === JSON.stringify(["note on Maria"]) && JSON.stringify(names(await see(S1, "select title from tasks"))) === JSON.stringify(["call Maria"]), { n: names(await see(S1, "select content from notes")), t: names(await see(S1, "select title from tasks")) });
  check("supervisor can't see personal records (notes, tasks, lists)", !(await see(S1, "select content from notes")).some((r) => r.content === "C1 personal note") && !(await see(S1, "select title from tasks")).some((r) => r.title === "C1 dentist") && (await see(S1, "select name from lists")).length === 0);
  check("admin sees org clients but not personal records", names(await see(A1, "select display_name from people")).length === 2 && !(await see(A1, "select content from notes")).some((r) => r.content === "C1 personal note"));
  check("other agency's admin sees nothing of Hope House", JSON.stringify(names(await see(A2, "select display_name from people"))) === JSON.stringify(["Sam (other agency)"]) && !(await see(A2, "select content from notes")).some((r) => r.content === "note on Maria"));
  check("Hope House supervisor sees nothing of the other agency", !(names(await see(S1, "select display_name from people")).includes("Sam (other agency)")));
  check("solo user sees only their own", JSON.stringify(names(await see(U, "select display_name from people"))) === JSON.stringify(["Friend (solo)"]));
  check("nobody in an organization sees the solo user's data", !(await see(A1, "select display_name from people")).some((r) => r.display_name === "Friend (solo)"));
  check("check-ins: supervisor sees org ones, other agency none", (await see(S1, "select id from check_ins")).length === 1 && (await see(A2, "select id from check_ins")).length === 0);

  const changed = await asUser(S1, (q) => q(`update people set display_name = 'hacked' where id = $1 returning id`, [P1.id]));
  check("supervisor can't edit a client (read-only)", changed.length === 0);
  check("case manager can't move a client into another agency", await fails(() => asUser(C1, (q) => q(`update people set org_id = $1 where id = $2`, [o2.id, P1.id]))));
  check("can't create records as someone else", await fails(() => asUser(C1, (q) => q(`insert into notes (user_id, content) values ($1, 'x')`, [C2]))));
  check("case managers can't see invitations; admin can", (await asUser(C1, (q) => q(`select id from invitations`))).length === 0 && await (async () => { await query(`insert into invitations (org_id, email, role, token_hash, expires_at) values ($1, 'new@t.dev', 'case_manager', 'h1', now() + interval '7 days')`, [o1.id]); return (await asUser(A1, (q) => q(`select id from invitations`))).length === 1; })());
  check("case manager can't make themselves admin", (await asUser(C1, (q) => q(`update memberships set role = 'admin' where user_id = $1 returning user_id`, [C1]))).length === 0);
  check("colleagues' names visible inside the org, not outside", (await asUser(C1, (q) => q(`select id from users`))).length === 4 && (await asUser(D1, (q) => q<{ id: string }>(`select id from users`))).every((r) => r.id !== C1));

  await query(`update memberships set active = false where user_id = $1`, [S1]);
  check("a deactivated supervisor loses access right away", (await see(S1, "select display_name from people")).length === 0);

  await query(`insert into notes (user_id, person_id, content) values ($1, $2, 'note on friend')`, [U, UP.id]);
  await query(`update people set org_id = $1 where id = $2`, [o1.id, UP.id]);
  check("moving a client into an org brings their notes along", (await queryOne<{ org_id: string }>(`select org_id from notes where content = 'note on friend'`))?.org_id === o1.id);

  const appView = await query(`select id from people where user_id = $1`, [C1]);
  check("the app's normal queries are unchanged", appView.length === 1);
  console.log(failures ? `${failures} FAILED` : "ALL PASSED");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
