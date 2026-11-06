import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db/client";
import { getSessionUser } from "@/lib/session";
import { CONTENT_TYPES, fileStem, renderTable, type ExportFormat } from "@/lib/export/table";
import type { List } from "@/lib/types";
import { isUuid } from "@/lib/ids";

// pdfkit and exceljs need Node APIs (fs, streams).
export const runtime = "nodejs";

type Row = {
  label: string;
  checked: boolean;
  phone: string | null;
  email: string | null;
  status: string | null;
  next_action: string | null;
};

/** Header + cell values for one table, shared by both formats. */
function buildTable(list: List, rows: Row[]): { headers: string[]; body: string[][] } {
  const headers = list.is_group
    ? ["#", "Name", "Done", "Phone", "Email", "Status", "Next action"]
    : ["#", "Item", "Done"];
  const body = rows.map((r, i) => {
    const base = [String(i + 1), r.label, r.checked ? "✓" : "–"];
    return list.is_group
      ? [...base, r.phone ?? "", r.email ?? "", r.status ?? "", r.next_action ?? ""]
      : base;
  });
  return { headers, body };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const userId = user.id;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "List not found" }, { status: 404 });
  const raw = new URL(request.url).searchParams.get("format");
  if (raw !== "pdf" && raw !== "xlsx") {
    return NextResponse.json({ error: "format must be pdf or xlsx" }, { status: 400 });
  }
  const format: ExportFormat = raw;

  const list = await queryOne<List>(
    `select * from lists where user_id = $1 and id = $2 and deleted_at is null`,
    [userId, id],
  );
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  const rows = await query<Row>(
    `select li.label, li.checked, p.phone, p.email,
            coalesce(p.current_status, p.status) as status, p.next_action
       from list_items li
       left join people p on p.id = li.person_id and p.deleted_at is null
      where li.user_id = $1 and li.list_id = $2
      order by li.position asc`,
    [userId, id],
  );

  const exportedOn = new Date().toISOString().slice(0, 10);
  const { headers, body } = buildTable(list, rows);
  const file = await renderTable(format, {
    title: list.name,
    description: list.description,
    meta: `Exported ${exportedOn} · ${body.length} items`,
    headers,
    body,
    // Narrow fixed columns for # and Done, the rest share the remaining width.
    fixedWidths: { 0: 28, 2: 40 },
  });

  const base = fileStem(list.name, "list");
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${base}-${exportedOn}.${format}"`,
    },
  });
}
