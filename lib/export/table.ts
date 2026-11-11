import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

/**
 * One table rendered as PDF or Excel. Shared by the list and check-in
 * exports. Routes using this need `export const runtime = "nodejs"`, and
 * pdfkit's font files must be traced into the bundle (next.config.mjs).
 */
export type ExportTable = {
  title: string;
  description?: string | null;
  /** Small grey line under the title, e.g. "Exported 2026-11-02 · 12 items". */
  meta: string;
  headers: string[];
  body: string[][];
  /** Fixed PDF column widths in points by column index; the rest share what's left. */
  fixedWidths?: Record<number, number>;
  emptyMessage?: string;
};

export type ExportFormat = "pdf" | "xlsx";

export const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function renderTable(format: ExportFormat, table: ExportTable): Promise<Buffer> {
  return format === "xlsx" ? toXlsx(table) : toPdf(table);
}

/** A filesystem-safe file name stem. */
export function fileStem(name: string, fallback: string): string {
  return name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || fallback;
}

async function toXlsx({ title, meta, headers, body }: ExportTable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // Excel caps sheet names at 31 chars and forbids a few characters.
  const ws = wb.addWorksheet(title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet");
  ws.addRow(headers);
  body.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  ws.columns.forEach((col, i) => {
    const longest = Math.max(headers[i].length, ...body.map((r) => (r[i] ?? "").length));
    col.width = Math.min(Math.max(longest + 2, 5), 50);
  });
  wb.creator = "Strynd";
  wb.title = `${title} (${meta})`;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function toPdf({ title, description, meta, headers, body, fixedWidths = {}, emptyMessage = "No items." }: ExportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const landscape = headers.length > 3;
    const doc = new PDFDocument({ size: "LETTER", layout: landscape ? "landscape" : "portrait", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;
    const fixedTotal = Object.values(fixedWidths).reduce((a, b) => a + b, 0);
    const flexCount = headers.length - Object.keys(fixedWidths).length;
    const flexWidth = flexCount > 0 ? (usable - fixedTotal) / flexCount : 0;
    const widths = headers.map((_, i) => fixedWidths[i] ?? flexWidth);
    const pad = 4;

    doc.font("Helvetica-Bold").fontSize(18).text(title);
    if (description) doc.font("Helvetica").fontSize(11).fillColor("#444").text(description);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#777").text(meta);
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
    if (body.length === 0) doc.moveDown().font("Helvetica-Oblique").text(emptyMessage, left);
    doc.end();
  });
}
