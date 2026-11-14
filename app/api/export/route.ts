import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { query } from "@/lib/db/client";
import { getSessionUser } from "@/lib/session";
import type { Activity, CheckIn, Person, List, ListItem, Note, Task } from "@/lib/types";

const COLUMNS = {
  people:
    "id, first_name, last_name, display_name, phone, email, birthday, gender, ethnicity, income_level, status, current_status, next_action, summary, needs_followup, client_since, created_at, updated_at, last_activity_at",
  notes: "id, person_id, content, category, created_at, updated_at",
  lists: "id, name, description, is_group, created_at, updated_at",
  list_items: "id, list_id, person_id, label, note, checked, position, created_at, updated_at",
  tasks: "id, title, notes, person_id, list_id, due_at, recurrence, completed, completed_at, created_at, updated_at",
  activity: "id, person_id, list_id, task_id, note_id, type, description, created_at",
  check_ins: "id, person_id, checked_in_at, reason, amount_cents, created_at, updated_at",
};

function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const userId = user.id;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  const [people, notes, lists, listItems, tasks, activity, checkIns, outcomes] = await Promise.all([
    query<Person>(`select ${COLUMNS.people} from people where user_id = $1 and deleted_at is null order by display_name`, [userId]),
    query<Note>(`select ${COLUMNS.notes} from notes where user_id = $1 and deleted_at is null order by created_at`, [userId]),
    query<List>(`select ${COLUMNS.lists} from lists where user_id = $1 and deleted_at is null order by name`, [userId]),
    query<ListItem>(`select ${COLUMNS.list_items} from list_items where user_id = $1 order by list_id, position`, [userId]),
    query<Task>(`select ${COLUMNS.tasks} from tasks where user_id = $1 and deleted_at is null order by due_at nulls last`, [userId]),
    query<Activity>(`select ${COLUMNS.activity} from activity where user_id = $1 order by created_at`, [userId]),
    query<CheckIn>(`select ${COLUMNS.check_ins} from check_ins where user_id = $1 and deleted_at is null order by checked_in_at`, [userId]),
    // Outcomes this person recorded (Settings → Outcomes), with the outcome's name.
    query<Record<string, unknown>>(
      `select po.id, po.person_id, o.name as outcome, to_char(po.achieved_on, 'YYYY-MM-DD') as achieved_on, po.note, po.created_at
         from person_outcomes po join outcomes o on o.id = po.outcome_id
        where po.user_id = $1 and po.deleted_at is null order by po.achieved_on`,
      [userId],
    ),
  ]);

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    // One table per CSV (Settings → Data lists a link for each); people by default.
    const tables: Record<string, unknown[]> = {
      people,
      notes,
      tasks,
      lists,
      list_items: listItems,
      check_ins: checkIns,
      outcomes,
      activity,
    };
    const name = searchParams.get("table") ?? "people";
    const rows = Object.hasOwn(tables, name) ? tables[name] : null;
    if (!rows) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
    const csv = toCsv(rows as Record<string, unknown>[]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="strynd-${name.replace("_", "-")}-${timestamp}.csv"`,
      },
    });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    people,
    notes,
    lists,
    list_items: listItems,
    tasks,
    activity,
    check_ins: checkIns,
    outcomes,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="strynd-export-${timestamp}.json"`,
    },
  });
}
