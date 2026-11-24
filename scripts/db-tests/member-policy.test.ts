/**
 * Database test for what organization Members may do with data (lib/member-policy.ts).
 * Runs against a THROWAWAY local Postgres only, never production:
 *   1. Start Postgres, create an empty database, run scripts/db-tests/supabase-stub.sql in it.
 *   2. POSTGRES_URL=postgresql://postgres@localhost:54329/st npx tsx --tsconfig tsconfig.json scripts/db-tests/member-policy.test.ts
 * Prints PASS/FAIL per check.
 */
import { query, queryOne } from "@/lib/db/client";
import { memberPolicyFor } from "@/lib/member-policy-core";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
const u = (n: number) => `00000000-0000-0000-0000-0000000002${String(n).padStart(2, "0")}`;
const [ADMIN, MANAGER, MEMBER, SOLO] = [1, 2, 3, 4].map(u);

async function main() {
  await query(`select 1`); // builds the schema
  for (const [i, id] of [ADMIN, MANAGER, MEMBER, SOLO].entries()) await query(`insert into users (id, email, name) values ($1, $2, $3)`, [id, `p${i}@t.dev`, `P ${i}`]);
  const [org] = await query<{ id: string; members_can_export: boolean; members_can_keep_private: boolean }>(
    `insert into organizations (name) values ('Harbor House') returning id, members_can_export, members_can_keep_private`,
  );
  check("both switches are off for a new organization", !org.members_can_export && !org.members_can_keep_private, org);
  for (const [id, role] of [[ADMIN, "admin"], [MANAGER, "supervisor"], [MEMBER, "case_manager"]])
    await query(`insert into memberships (org_id, user_id, role) values ($1, $2, $3)`, [org.id, id, role]);

  // Who the rules apply to.
  const pm = await memberPolicyFor(MEMBER);
  check("a Member can't download or keep private contacts by default", pm.managed && !pm.canExport && !pm.canKeepPrivate, pm);
  for (const [name, id] of [["an Admin", ADMIN], ["a Manager", MANAGER], ["a solo account", SOLO]] as const) {
    const p = await memberPolicyFor(id);
    check(`${name} isn't limited`, !p.managed && p.canExport && p.canKeepPrivate, p);
  }

  // "Keep private" is ignored for a Member: the client joins the organization.
  const [kept] = await query<{ id: string; org_id: string | null; personal: boolean }>(
    `insert into people (user_id, first_name, display_name, personal) values ($1, 'Rosa', 'Rosa M.', true) returning id, org_id, personal`,
    [MEMBER],
  );
  check("a Member's 'private' contact joins the organization anyway", kept.org_id === org.id && !kept.personal, kept);

  // A Member can't take an organization client private.
  const blocked = await query(`update people set org_id = null, personal = true where id = $1`, [kept.id]).then(
    () => false,
    () => true,
  );
  check("a Member can't make an organization client private", blocked);
  const still = await queryOne<{ org_id: string | null }>(`select org_id from people where id = $1`, [kept.id]);
  check("the client stays with the organization", still?.org_id === org.id, still);

  // An Admin's own private contact still works.
  const [adminPrivate] = await query<{ org_id: string | null; personal: boolean }>(
    `insert into people (user_id, first_name, display_name, personal) values ($1, 'Mom', 'Mom', true) returning org_id, personal`,
    [ADMIN],
  );
  check("an Admin can still keep a private contact", adminPrivate.org_id === null && adminPrivate.personal, adminPrivate);

  // The organization deleting itself still clears org_id without tripping the rule.
  // (FK "on delete set null" leaves personal false, so the guard doesn't fire.)

  // Admin turns both on: the Member gets them.
  await query(`update organizations set members_can_export = true, members_can_keep_private = true where id = $1`, [org.id]);
  const on = await memberPolicyFor(MEMBER);
  check("with both switches on, the Member can download and keep private contacts", on.canExport && on.canKeepPrivate, on);
  const [now] = await query<{ org_id: string | null; personal: boolean }>(
    `insert into people (user_id, first_name, display_name, personal) values ($1, 'Dentist', 'Dentist', true) returning org_id, personal`,
    [MEMBER],
  );
  check("…and their private contact stays private", now.org_id === null && now.personal, now);
  const allowed = await query(`update people set org_id = null, personal = true where id = $1`, [kept.id]).then(
    () => true,
    () => false,
  );
  check("…and they may make one of their clients private", allowed);

  // Deleting the organization (FK set null) never trips the guard.
  await query(`update organizations set members_can_keep_private = false where id = $1`, [org.id]);
  const [p2] = await query<{ id: string }>(`insert into people (user_id, first_name, display_name) values ($1, 'Omar', 'Omar') returning id`, [MEMBER]);
  const deleted = await query(`delete from organizations where id = $1`, [org.id]).then(
    () => true,
    (e) => String(e),
  );
  check("deleting the organization still works", deleted === true, deleted);
  const orphan = await queryOne<{ org_id: string | null }>(`select org_id from people where id = $1`, [p2.id]);
  check("its clients are released as before", orphan?.org_id === null, orphan);

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
