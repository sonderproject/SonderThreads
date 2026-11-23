/**
 * Database test for exits. Runs against a THROWAWAY local Postgres only, never production:
 *   1. Start Postgres, create an empty database, run scripts/db-tests/supabase-stub.sql in it.
 *   2. POSTGRES_URL=postgresql://postgres@localhost:54329/st npx tsx --tsconfig tsconfig.json scripts/db-tests/exits.test.ts
 * Prints PASS/FAIL per check.
 */
import { query, queryOne } from "@/lib/db/client";
import { asUser } from "@/lib/db/as-user";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
const u = (n: number) => `00000000-0000-0000-0000-0000000001${String(n).padStart(2, "0")}`;
const [A1, M1, A2, SOLO] = [1, 2, 3, 4].map(u);

async function main() {
  await query(`select 1`); // builds the schema
  for (const [i, id] of [A1, M1, A2, SOLO].entries()) await query(`insert into users (id, email, name) values ($1, $2, $3)`, [id, `x${i}@t.dev`, `X ${i}`]);
  const [o1] = await query<{ id: string }>(`insert into organizations (name) values ('Harbor House') returning id`);
  const [o2] = await query<{ id: string }>(`insert into organizations (name) values ('Elsewhere') returning id`);
  for (const [id, org, role] of [[A1, o1.id, "admin"], [M1, o1.id, "case_manager"], [A2, o2.id, "admin"]])
    await query(`insert into memberships (org_id, user_id, role) values ($1, $2, $3)`, [org, id, role]);

  const [p] = await query<{ id: string; org_id: string }>(`insert into people (user_id, first_name, display_name) values ($1, 'Jasmine', 'Jasmine R.') returning id, org_id`, [M1]);
  check("client belongs to the organization", p.org_id === o1.id, p);

  const [housing] = await query<{ id: string }>(`insert into exit_reasons (org_id, name, kind, position) values ($1, 'Found permanent housing', 'positive', 1) returning id`, [o1.id]);
  const [lost] = await query<{ id: string }>(`insert into exit_reasons (org_id, name, kind, position) values ($1, 'Lost contact', 'unplanned', 2) returning id`, [o1.id]);
  check("reason names are unique per organization", await query(`insert into exit_reasons (org_id, name, kind) values ($1, 'found permanent housing', 'positive')`, [o1.id]).then(() => false, () => true));
  check("only the three groups are allowed", await query(`insert into exit_reasons (org_id, name, kind) values ($1, 'Odd', 'negative')`, [o1.id]).then(() => false, () => true));

  // Exit (as the app does it), then re-enroll and exit again.
  const [e1] = await query<{ id: string; org_id: string }>(
    `insert into person_exits (user_id, person_id, reason_id, kind, exited_on, note) values ($1, $2, $3, 'unplanned', '2026-09-01', 'No answer since August') returning id, org_id`,
    [M1, p.id, lost.id],
  );
  check("an exit takes the client's organization", e1.org_id === o1.id, e1);
  await query(`update person_exits set reopened_at = now() where id = $1`, [e1.id]);
  await query(`insert into person_exits (user_id, person_id, reason_id, kind, exited_on) values ($1, $2, $3, 'positive', '2026-11-10')`, [M1, p.id, housing.id]);
  await query(
    `update people set exited_on = (select max(exited_on) from person_exits where person_id = $1 and deleted_at is null and reopened_at is null) where id = $1`,
    [p.id],
  );
  const person = await queryOne<{ exited_on: string; deleted_at: string | null }>(`select to_char(exited_on, 'YYYY-MM-DD') as exited_on, deleted_at from people where id = $1`, [p.id]);
  check("the client stays, marked exited on the latest date", person?.exited_on === "2026-11-10" && person.deleted_at === null, person);
  const hist = await query(`select 1 from person_exits where person_id = $1 and deleted_at is null`, [p.id]);
  check("both exits are kept in history", hist.length === 2, hist.length);

  // A later re-grouping of the reason doesn't rewrite the exit already recorded.
  await query(`update exit_reasons set kind = 'neutral' where id = $1`, [lost.id]);
  const kept = await queryOne<{ kind: string }>(`select kind from person_exits where id = $1`, [e1.id]);
  check("past exits keep the group they had", kept?.kind === "unplanned", kept);

  // Who can read them (Supabase API rules).
  const adminSees = await asUser(A1, (q) => q(`select id from person_exits where person_id = $1`, [p.id]));
  check("the organization's admin can read its exits", adminSees.length === 2, adminSees.length);
  const otherSees = await asUser(A2, (q) => q(`select id from person_exits`, []));
  check("another organization's admin can't", otherSees.length === 0, otherSees.length);
  const otherReasons = await asUser(A2, (q) => q(`select id from exit_reasons`, []));
  check("another organization can't read the reason list", otherReasons.length === 0, otherReasons.length);
  const forge = await asUser(A2, (q) =>
    q(`insert into person_exits (user_id, person_id, reason_id, kind, exited_on) values ($1, $2, $3, 'positive', '2026-11-01')`, [A1, p.id, housing.id]).then(
      () => false,
      () => true,
    ),
  );
  check("nobody can record an exit as someone else", forge);

  // Solo accounts keep their own list.
  await query(`insert into exit_reasons (user_id, name, kind) values ($1, 'Project finished', 'positive')`, [SOLO]);
  const soloSees = await asUser(SOLO, (q) => q(`select name from exit_reasons`, []));
  check("a solo account sees only its own reasons", soloSees.length === 1, soloSees);

  // Leaving the organization takes the exits along.
  await query(`update people set org_id = null where id = $1`, [p.id]);
  const moved = await query<{ org_id: string | null }>(`select org_id from person_exits where person_id = $1`, [p.id]);
  check("exits follow the client out of the organization", moved.every((r) => r.org_id === null), moved);

  console.log(failures ? `${failures} FAILED` : "ALL PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
