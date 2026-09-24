import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import type { Activity, Client, List, ListItem, Note, Task } from "@/lib/types";

const COLUMNS = {
  clients:
    "id, first_name, last_name, display_name, phone, email, birthday, status, current_status, next_action, summary, needs_followup, created_at, updated_at, last_activity_at",
  notes: "id, client_id, content, category, created_at, updated_at",
  lists: "id, name, description, is_cohort, created_at, updated_at",
  list_items: "id, list_id, client_id, label, checked, position, created_at, updated_at",
  tasks: "id, title, notes, client_id, list_id, due_at, completed, completed_at, created_at, updated_at",
  activity: "id, client_id, list_id, task_id, note_id, type, description, created_at",
};

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  // pg returns timestamptz/timestamp/date columns as native JS Date objects
  // (despite our TS types declaring them as string) — format those as plain
  // ISO strings rather than JSON.stringify-ing them, which would wrap the
  // already-quoted JSON string in a second layer of CSV quoting.
  const s =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => toCsvValue(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  const [clients, notes, lists, listItems, tasks, activity] = await Promise.all([
    query<Client>(`select ${COLUMNS.clients} from clients where user_id = $1 and deleted_at is null order by display_name`, [OWNER_ID]),
    query<Note>(`select ${COLUMNS.notes} from notes where user_id = $1 and deleted_at is null order by created_at`, [OWNER_ID]),
    query<List>(`select ${COLUMNS.lists} from lists where user_id = $1 and deleted_at is null order by name`, [OWNER_ID]),
    query<ListItem>(`select ${COLUMNS.list_items} from list_items where user_id = $1 order by list_id, position`, [OWNER_ID]),
    query<Task>(`select ${COLUMNS.tasks} from tasks where user_id = $1 and deleted_at is null order by due_at nulls last`, [OWNER_ID]),
    query<Activity>(`select ${COLUMNS.activity} from activity where user_id = $1 order by created_at`, [OWNER_ID]),
  ]);

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    // A .zip would let us ship all six tables, but that's a real dependency
    // for a "download your data" button — CSV export covers the one people
    // actually ask for (a client roster to open in a spreadsheet).
    const csv = toCsv(clients as unknown as Record<string, unknown>[]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="clients-${timestamp}.csv"`,
      },
    });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    clients,
    notes,
    lists,
    list_items: listItems,
    tasks,
    activity,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="client-command-center-export-${timestamp}.json"`,
    },
  });
}
