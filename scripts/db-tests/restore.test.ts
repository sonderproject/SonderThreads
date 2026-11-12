/**
 * Database test. Runs against a THROWAWAY local Postgres only, never production:
 *   1. Start Postgres and create an empty database, then (for Supabase-like
 *      roles) run scripts/db-tests/supabase-stub.sql in it.
 *   2. POSTGRES_URL=postgresql://postgres@localhost:54329/st npx tsx --tsconfig tsconfig.json scripts/db-tests/<file>.ts
 * The app builds its schema on first query. Prints PASS/FAIL per check.
 */
import { query, queryOne } from "@/lib/db/client";
import { parseBackup, restoreInto, countsOf } from "@/lib/restore-core";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + JSON.stringify(detail)}`);
  if (!ok) failures++;
}

const COLUMNS = {
  people: "id, first_name, last_name, display_name, phone, email, birthday, gender, ethnicity, income_level, status, current_status, next_action, summary, needs_followup, client_since, created_at, updated_at, last_activity_at",
  notes: "id, person_id, content, category, created_at, updated_at",
  lists: "id, name, description, is_group, created_at, updated_at",
  list_items: "id, list_id, person_id, label, note, checked, position, created_at, updated_at",
  tasks: "id, title, notes, person_id, list_id, due_at, recurrence, completed, completed_at, created_at, updated_at",
  activity: "id, person_id, list_id, task_id, note_id, type, description, created_at",
  check_ins: "id, person_id, checked_in_at, reason, amount_cents, created_at, updated_at",
};
async function exportOf(u: string) {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const [t, cols] of Object.entries(COLUMNS)) out[t] = await query(`select ${cols} from ${t} where user_id = $1`, [u]);
  return JSON.parse(JSON.stringify(out)); // same as downloading the file
}
const counts = async (u: string) =>
  queryOne<Record<string, number>>(
    `select (select count(*) from people where user_id=$1)::int people, (select count(*) from notes where user_id=$1)::int notes,
            (select count(*) from tasks where user_id=$1)::int tasks, (select count(*) from check_ins where user_id=$1)::int check_ins,
            (select count(*) from lists where user_id=$1)::int lists, (select count(*) from list_items where user_id=$1)::int list_items,
            (select count(*) from activity where user_id=$1)::int activity`,
    [u],
  );

async function main() {
  await query(`insert into users (id, email) values ($1,'a@test.dev'),($2,'b@test.dev') on conflict do nothing`, [A, B]);
  const [p1] = await query<{ id: string }>(`insert into people (user_id, first_name, last_name, display_name, birthday, gender, ethnicity, income_level, client_since) values ($1,'Maria','Lopez','Maria Lopez','1980-05-12','Female','Hispanic or Latino','Low','2020-02-03') returning id`, [A]);
  const [p2] = await query<{ id: string }>(`insert into people (user_id, first_name, display_name) values ($1,'Jo','Jo') returning id`, [A]);
  const [n1] = await query<{ id: string }>(`insert into notes (user_id, person_id, content) values ($1,$2,'Housing intake done') returning id`, [A, p1.id]);
  await query(`insert into notes (user_id, content) values ($1,'personal note')`, [A]);
  const [l1] = await query<{ id: string }>(`insert into lists (user_id, name, is_group) values ($1,'Groceries',false) returning id`, [A]);
  const [l2] = await query<{ id: string }>(`insert into lists (user_id, name, is_group) values ($1,'Tuesday group',true) returning id`, [A]);
  await query(`insert into list_items (user_id, list_id, label, note) values ($1,$2,'milk','2%')`, [A, l1.id]);
  await query(`insert into list_items (user_id, list_id, person_id, label) values ($1,$2,$3,'Maria Lopez')`, [A, l2.id, p1.id]);
  const [t1] = await query<{ id: string }>(`insert into tasks (user_id, title, person_id, due_at, recurrence) values ($1,'Call Maria',$2, now() - interval '2 days','weekly') returning id`, [A, p1.id]);
  await query(`insert into tasks (user_id, title, due_at) values ($1,'Dentist', now() + interval '3 days')`, [A]);
  await query(`insert into check_ins (user_id, person_id, reason, amount_cents) values ($1,$2,'Walk-in',2500)`, [A, p1.id]);
  await query(`insert into activity (user_id, person_id, task_id, note_id, type, description) values ($1,$2,$3,$4,'note_added','Added a note')`, [A, p1.id, t1.id, n1.id]);
  // B already has a "Groceries" list and one person of its own.
  const [bList] = await query<{ id: string }>(`insert into lists (user_id, name) values ($1,'groceries') returning id`, [B]);
  await query(`insert into people (user_id, first_name, display_name) values ($1,'Own','Own')`, [B]);

  const before = await counts(A);
  const file = await exportOf(A);
  const backup = parseBackup(file);
  check("preview counts", JSON.stringify(countsOf(backup)) === JSON.stringify({ people: 2, notes: 2, tasks: 2, check_ins: 1, lists: 2, list_items: 2, activity: 1 }), countsOf(backup));

  const added = await restoreInto(B, backup);
  check("restore into another account adds everything (Groceries merged)", JSON.stringify(added) === JSON.stringify({ people: 2, notes: 2, tasks: 2, check_ins: 1, lists: 1, list_items: 2, activity: 1 }), added);
  const bc = await counts(B);
  check("B totals", bc?.people === 3 && bc?.lists === 2 && bc?.list_items === 2, bc);

  // Links point at B's own records, never at A's.
  const crossLinks = await queryOne<{ n: number }>(
    `select (
       (select count(*) from notes n join people p on p.id = n.person_id where n.user_id=$1 and p.user_id<>$1) +
       (select count(*) from tasks t join people p on p.id = t.person_id where t.user_id=$1 and p.user_id<>$1) +
       (select count(*) from check_ins c join people p on p.id = c.person_id where c.user_id=$1 and p.user_id<>$1) +
       (select count(*) from list_items i join lists l on l.id = i.list_id where i.user_id=$1 and l.user_id<>$1) +
       (select count(*) from activity a join tasks t on t.id = a.task_id where a.user_id=$1 and t.user_id<>$1))::int n`,
    [B],
  );
  check("no links into the other account", crossLinks?.n === 0, crossLinks);
  const maria = await queryOne<{ id: string; gender: string; birthday: string }>(`select id, gender, to_char(birthday,'YYYY-MM-DD') birthday from people where user_id=$1 and display_name='Maria Lopez'`, [B]);
  const kept = await queryOne<{ since: string; amount: number }>(
    `select to_char(p.client_since,'YYYY-MM-DD') since, (select amount_cents from check_ins where person_id = p.id) amount from people p where p.id = $1`,
    [maria?.id],
  );
  check("restore keeps client-since dates and visit amounts", kept?.since === "2020-02-03" && kept?.amount === 2500, kept);
  const linked = await queryOne<{ notes: number; tasks: number; checkins: number; entries: number }>(
    `select (select count(*) from notes where person_id=$1)::int notes, (select count(*) from tasks where person_id=$1)::int tasks,
            (select count(*) from check_ins where person_id=$1)::int checkins, (select count(*) from list_items where person_id=$1)::int entries`,
    [maria!.id],
  );
  check("Maria's note, task, check-in and group entry stay linked", linked?.notes === 1 && linked?.tasks === 1 && linked?.checkins === 1 && linked?.entries === 1, linked);
  check("demographics and birthday kept", maria?.gender === "Female" && maria?.birthday === "1980-05-12", maria);
  const milk = await queryOne<{ list_id: string; note: string }>(`select list_id, note from list_items where user_id=$1 and label='milk'`, [B]);
  check("Groceries entries merged into B's existing list, note kept", milk?.list_id === bList.id && milk?.note === "2%", milk);
  const overdue = await queryOne<{ reminded: boolean; recurrence: string }>(`select reminded_at is not null reminded, recurrence from tasks where user_id=$1 and title='Call Maria'`, [B]);
  check("past-due task marked reminded (no reminder burst), recurrence kept", overdue?.reminded === true && overdue?.recurrence === "weekly", overdue);

  const again = await restoreInto(B, backup);
  check("importing the same file again adds nothing", Object.values(again).every((n) => n === 0), again);
  const same = await restoreInto(A, backup);
  check("restoring into the original account adds nothing", Object.values(same).every((n) => n === 0), same);
  check("original account unchanged", JSON.stringify(await counts(A)) === JSON.stringify(before), await counts(A));

  let rejected = false;
  try { parseBackup({ people: [{ name: "x" }] }); } catch { rejected = true; }
  check("a non-backup file is rejected", rejected);

  // All or nothing: a bad row makes the whole restore roll back.
  const C = "00000000-0000-0000-0000-00000000000c";
  await query(`insert into users (id, email) values ($1,'c@test.dev')`, [C]);
  const broken = parseBackup(file);
  (broken.tasks[0] as { title: string }).title = "ok";
  await query(`alter table activity add constraint t_fail check (type <> 'note_added') not valid`);
  let failed = false;
  try { await restoreInto(C, broken); } catch { failed = true; }
  await query(`alter table activity drop constraint t_fail`);
  const cc = await counts(C);
  check("a failure part-way saves nothing", failed && Object.values(cc ?? {}).every((n) => n === 0), { failed, cc });
  console.log(failures ? `${failures} FAILED` : "ALL PASSED");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
