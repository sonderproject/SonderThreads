import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { buildBackup } from "@/lib/export/backup";
import { getSessionUser } from "@/lib/session";

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

  const data = await buildBackup(userId);
  const { people, notes, lists, list_items: listItems, tasks, activity, check_ins: checkIns, outcomes, exits } = data;

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
      exits,
      activity,
    };
    const name = searchParams.get("table") ?? "people";
    const rows = Object.hasOwn(tables, name) ? tables[name] : null;
    if (!rows) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
    const csv = toCsv(rows as Record<string, unknown>[]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="surfdesk-${name.replace("_", "-")}-${timestamp}.csv"`,
      },
    });
  }

  const payload = { exported_at: new Date().toISOString(), ...data };


  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="surfdesk-export-${timestamp}.json"`,
    },
  });
}
