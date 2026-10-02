import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import type { List } from "@/lib/types";

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

type Format = "pdf" | "xlsx";

const CONTENT_TYPES: Record<Format, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

async function toXlsx(list: List, exportedOn: string, headers: string[], body: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // Excel caps sheet names at 31 chars and forbids a few characters.
  const ws = wb.addWorksheet(list.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "List");
  ws.addRow(headers);
  body.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  ws.columns.forEach((col, i) => {
    const longest = Math.max(headers[i].length, ...body.map((r) => r[i].length));
    col.width = Math.min(Math.max(longest + 2, 5), 50);
  });
  wb.creator = "sonderthreads";
  wb.title = `${list.name} (exported ${exportedOn})`;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function toPdf(list: List, exportedOn: string, headers: string[], body: string[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const landscape = headers.length > 3;
    const doc = new PDFDocument({ size: "LETTER", layout: landscape ? "landscape" : "portrait", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;
    // Narrow fixed columns for # and Done, the rest share the remaining width.
    const fixed: Record<number, number> = { 0: 28, 2: 40 };
    const flexCount = headers.length - Object.keys(fixed).length;
    const flexWidth = (usable - Object.values(fixed).reduce((a, b) => a + b, 0)) / flexCount;
    const widths = headers.map((_, i) => fixed[i] ?? flexWidth);
    const pad = 4;

    doc.font("Helvetica-Bold").fontSize(18).text(list.name);
    if (list.description) doc.font("Helvetica").fontSize(11).fillColor("#444").text(list.description);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#777").text(`Exported ${exportedOn} · ${body.length} items`);
    doc.moveDown(0.8).fillColor("#000");

    // pdfkit's built-in Helvetica has no ✓ glyph; use plain text instead.
    const pdfSafe = (v: string) => (v === "✓" ? "Yes" : v === "–" ? "-" : v);

    const drawRow = (cells: string[], bold: boolean) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      const height =
        Math.max(...cells.map((v, i) => doc.heightOfString(pdfSafe(v) || " ", { width: widths[i] - pad * 2 }))) + pad * 2;
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        if (!bold) {
          drawRow(headers, true);
          doc.font("Helvetica");
        }
      }
      const y = doc.y;
      let x = left;
      if (bold) doc.rect(left, y, usable, height).fill("#eeeeee").fillColor("#000");
      cells.forEach((v, i) => {
        doc.rect(x, y, widths[i], height).lineWidth(0.5).strokeColor("#bbbbbb").stroke();
        doc.text(pdfSafe(v), x + pad, y + pad, { width: widths[i] - pad * 2 });
        x += widths[i];
      });
      doc.x = left;
      doc.y = y + height;
    };

    drawRow(headers, true);
    body.forEach((r) => drawRow(r, false));
    if (body.length === 0) doc.moveDown().font("Helvetica-Oblique").text("No items.", left);
    doc.end();
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = new URL(request.url).searchParams.get("format");
  if (raw !== "pdf" && raw !== "xlsx") {
    return NextResponse.json({ error: "format must be pdf or xlsx" }, { status: 400 });
  }
  const format: Format = raw;

  const list = await queryOne<List>(
    `select * from lists where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, id],
  );
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  const rows = await query<Row>(
    `select li.label, li.checked, p.phone, p.email,
            coalesce(p.current_status, p.status) as status, p.next_action
       from list_items li
       left join people p on p.id = li.person_id and p.deleted_at is null
      where li.user_id = $1 and li.list_id = $2
      order by li.position asc`,
    [OWNER_ID, id],
  );

  const exportedOn = new Date().toISOString().slice(0, 10);
  const { headers, body } = buildTable(list, rows);
  const file =
    format === "xlsx"
      ? await toXlsx(list, exportedOn, headers, body)
      : await toPdf(list, exportedOn, headers, body);

  const base = list.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "list";
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${base}-${exportedOn}.${format}"`,
    },
  });
}
