/**
 * Database test for the Admin "Export everything" (lib/export/org-export.ts).
 * Runs against a THROWAWAY local Postgres only, never production:
 *   1. Start Postgres, create an empty database, run scripts/db-tests/supabase-stub.sql in it.
 *   2. POSTGRES_URL=postgresql://postgres@localhost:54329/st npx tsx --tsconfig tsconfig.json scripts/db-tests/org-export.test.ts
 */
import { query } from "@/lib/db/client";
import { buildOrgExport } from "@/lib/export/org-export";

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
};
const u = (n: number) => `00000000-0000-0000-0000-0000000003${String(n).padStart(2, "0")}`;
const [ADMIN, MEMBER, OTHER] = [1, 2, 3].map(u);

async function main() {
  await query(`select 1`); // builds the schema
  for (const [i, id] of [ADMIN, MEMBER, OTHER].entries()) await query(`insert into users (id, email, name) values ($1, $2, $3)`, [id, `e${i}@t.dev`, `Staff ${i}`]);
  const [org] = await query<{ id: string }>(`insert into organizations (name, members_can_keep_private) values ('Harbor House', true) returning id`);
  const [other] = await query<{ id: string }>(`insert into organizations (name) values ('Elsewhere') returning id`);
  await query(`insert into memberships (org_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'case_manager'), ($4, $5, 'admin')`, [org.id, ADMIN, MEMBER, other.id, OTHER]);

  const [client] = await query<{ id: string }>(`insert into people (user_id, first_name, display_name, phone) values ($1, 'Jasmine', 'Jasmine R.', '555-0100') returning id`, [MEMBER]);
  await query(`insert into people (user_id, first_name, display_name, personal) values ($1, 'Mom', 'Mom (private)', true)`, [MEMBER]);
  await query(`insert into people (user_id, first_name, display_name) values ($1, 'Stranger', 'Other org client')`, [OTHER]);
  await query(`insert into check_ins (user_id, person_id, reason) values ($1, $2, 'Housing help')`, [MEMBER, client.id]);
  await query(`insert into notes (user_id, person_id, content) values ($1, $2, 'Starts work Monday')`, [MEMBER, client.id]);
  await query(`insert into tasks (user_id, person_id, title) values ($1, $2, 'Call Jasmine')`, [MEMBER, client.id]);

  const data = await buildOrgExport(org.id);
  const names = data.clients.map((c) => c.display_name);
  check("the organization's client is included", names.includes("Jasmine R."), names);
  check("with who on staff it's assigned to", data.clients.find((c) => c.display_name === "Jasmine R.")?.assigned_to === "Staff 1", data.clients);
  check("a Member's private contact is never included", !names.includes("Mom (private)"), names);
  check("another organization's client is never included", !names.includes("Other org client"), names);
  check("visits are included with who logged them", data.visits.length === 1 && data.visits[0].logged_by === "Staff 1", data.visits);
  check("notes are included", data.notes.length === 1 && data.notes[0].content === "Starts work Monday", data.notes);
  check("tasks are never included", !("tasks" in data) && !JSON.stringify(data).includes("Call Jasmine"));
  const otherData = await buildOrgExport(other.id);
  check("the other organization's export has only its own client", otherData.clients.length === 1 && otherData.clients[0].display_name === "Other org client", otherData.clients);

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
