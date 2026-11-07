import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { Kpis, Metrics, Point } from "@/lib/metrics-shared";

/**
 * Metrics exports: a funder-ready PDF (headline numbers + bar charts), an
 * Excel workbook with one sheet per metric, and a CSV of the headline numbers.
 * The PDF uses fixed print colors (it's paper, not the app's themes).
 */

const KPI_ROWS: [keyof Kpis, string][] = [
  ["peopleServed", "People served (unduplicated)"],
  ["checkIns", "Check-ins"],
  ["newPeople", "New people"],
  ["notes", "Notes written"],
  ["tasksDone", "Tasks completed"],
];

const SECTIONS = (m: Metrics): [string, Point[]][] => [
  [`Check-ins per ${m.bucket}`, m.checkInsOverTime],
  [`New people per ${m.bucket}`, m.newPeopleOverTime],
  ["Check-ins by day of week", m.byWeekday],
  ["Check-ins by reason", m.byReason],
  ["Ethnicity (people served)", m.byEthnicity],
  ["Income level (people served)", m.byIncome],
  ["Most frequent visitors (top 10)", m.topVisitors],
];

function fmtDay(day: string): string {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function change(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? "new" : "-";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return pct === 0 ? "0%" : `${pct > 0 ? "+" : ""}${pct}%`;
}

export function periodLabel(m: Metrics): string {
  return `${fmtDay(m.from)} – ${fmtDay(m.to)}`;
}

export function metricsCsv(m: Metrics): string {
  const rows = [
    ["Metric", "This period", "Previous period", "Change"],
    ...KPI_ROWS.map(([k, label]) => [label, String(m.kpis[k]), String(m.prev[k]), change(m.kpis[k], m.prev[k])]),
  ];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [`Period,${esc(periodLabel(m))}`, `Previous period,${esc(`${fmtDay(m.prevFrom)} – ${fmtDay(m.prevTo)}`)}`, "", ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export async function metricsXlsx(m: Metrics): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "sonderthreads";
  const summary = wb.addWorksheet("Summary");
  summary.addRow(["Metrics", periodLabel(m)]);
  summary.addRow(["Compared with", `${fmtDay(m.prevFrom)} – ${fmtDay(m.prevTo)}`]);
  summary.addRow([]);
  summary.addRow(["Metric", "This period", "Previous period", "Change"]).font = { bold: true };
  for (const [k, label] of KPI_ROWS) summary.addRow([label, m.kpis[k], m.prev[k], change(m.kpis[k], m.prev[k])]);
  summary.getRow(1).font = { bold: true, size: 13 };
  summary.columns = [{ width: 32 }, { width: 16 }, { width: 16 }, { width: 10 }];

  for (const [title, points] of SECTIONS(m)) {
    const ws = wb.addWorksheet(title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    ws.addRow([title.includes("visitors") ? "Person" : title.includes("reason") ? "Reason" : title.includes("Ethnicity") ? "Ethnicity" : title.includes("Income") ? "Income level" : title.includes("week") ? "Day" : "Period", "Count"]).font = { bold: true };
    for (const p of points) ws.addRow([p.label, p.value]);
    ws.addRow(["Total", points.reduce((s, p) => s + p.value, 0)]).font = { bold: true };
    ws.columns = [{ width: 30 }, { width: 10 }];
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const INK = "#1a211d";
const MUTED = "#56635c";
const LINE = "#d5ddd8";
const BAR = "#1a7f56";

export function metricsPdf(m: Metrics): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
    const ensure = (h: number) => {
      if (doc.y + h > bottomLimit()) doc.addPage();
    };

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text("Metrics report", left, doc.y);
    doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(periodLabel(m));
    doc.fontSize(9).text(`Compared with ${fmtDay(m.prevFrom)} – ${fmtDay(m.prevTo)} · Generated ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown(1);

    // Headline numbers: a row of tiles.
    const tileW = (width - 4 * 8) / 5;
    const tileY = doc.y;
    KPI_ROWS.forEach(([k, label], i) => {
      const x = left + i * (tileW + 8);
      doc.roundedRect(x, tileY, tileW, 62, 4).lineWidth(0.75).strokeColor(LINE).stroke();
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(label, x + 8, tileY + 8, { width: tileW - 16 });
      doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text(m.kpis[k].toLocaleString("en-US"), x + 8, tileY + 26, { width: tileW - 16 });
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(`${change(m.kpis[k], m.prev[k])} vs before (${m.prev[k]})`, x + 8, tileY + 48, { width: tileW - 16 });
    });
    doc.x = left;
    doc.y = tileY + 62 + 22;

    for (const [title, points] of SECTIONS(m)) {
      const total = points.reduce((s, p) => s + p.value, 0);
      // Columns for time series; horizontal bars for categories.
      const horizontal = title.includes("reason") || title.includes("visitors") || title.includes("served");
      const chartH = horizontal ? Math.max(1, points.length) * 16 + 4 : 120;
      ensure(36 + chartH + 24);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(title, left, doc.y, { continued: false });
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(`Total: ${total.toLocaleString("en-US")}`);
      doc.moveDown(0.4);
      const top = doc.y;
      const max = Math.max(1, ...points.map((p) => p.value));

      if (!points.length || total === 0) {
        doc.fontSize(9).fillColor(MUTED).text("No data in this period.", left, top);
        doc.moveDown(1.5);
        continue;
      }

      if (horizontal) {
        const labelW = 150;
        const barMax = width - labelW - 40;
        points.forEach((p, i) => {
          const y = top + i * 16;
          doc.font("Helvetica").fontSize(8.5).fillColor(INK).text(p.label, left, y + 2, { width: labelW - 8, ellipsis: true, lineBreak: false });
          const w = Math.max(2, (p.value / max) * barMax);
          doc.rect(left + labelW, y + 2, w, 10).fill(BAR);
          doc.fontSize(8.5).fillColor(MUTED).text(String(p.value), left + labelW + w + 4, y + 2, { lineBreak: false });
        });
        doc.x = left;
        doc.y = top + chartH + 14;
      } else {
        const plotH = chartH - 16;
        const slot = width / points.length;
        const barW = Math.max(1.5, Math.min(16, slot - 2));
        doc.moveTo(left, top + plotH).lineTo(left + width, top + plotH).lineWidth(0.5).strokeColor(LINE).stroke();
        const every = Math.max(1, Math.ceil(points.length / 10));
        points.forEach((p, i) => {
          const h = (p.value / max) * (plotH - 12);
          const x = left + i * slot + (slot - barW) / 2;
          if (p.value > 0) doc.rect(x, top + plotH - h, barW, h).fill(BAR);
          if (p.value === max) doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text(String(p.value), x - 10, top + plotH - h - 10, { width: barW + 20, align: "center", lineBreak: false });
          if (i % every === 0) doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(p.label, left + i * slot - 10, top + plotH + 4, { width: slot + 20, align: "center", lineBreak: false });
        });
        doc.x = left;
        doc.y = top + chartH + 16;
      }
    }

    doc.end();
  });
}
