import ExcelJS from "exceljs";
import { csvCell } from "@/lib/csv";
import { buildStory, HEATMAP_BLOCKS, WEEKDAY_NAMES, type Kpis, type Metrics, type Point } from "@/lib/metrics-shared";

/**
 * Metrics exports: an Excel workbook with one sheet per metric and a CSV of
 * the headline numbers. The designed PDF report lives in ./impact-pdf.ts.
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
  ["Gender (people served)", m.byGender],
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
  const esc = csvCell;
  const services = m.services.length
    ? [
        "",
        ["Service", "Times", "Previous period", "People", "Value"].map(esc).join(","),
        ...m.services.map((s) => [s.name, String(s.count), String(s.prevCount), String(s.people), (s.valueCents / 100).toFixed(2)].map(esc).join(",")),
      ]
    : [];
  const outcomes = m.outcomes.length
    ? [
        "",
        ["Outcome", "People", "Previous period"].map(esc).join(","),
        ...m.outcomes.map((o) => [o.name, String(o.people), String(o.prevPeople)].map(esc).join(",")),
        ["Reached any outcome", String(m.outcomePeople), String(m.prevOutcomePeople)].map(esc).join(","),
      ]
    : [];
  return [
    `Period,${esc(periodLabel(m))}`,
    `Previous period,${esc(`${fmtDay(m.prevFrom)} – ${fmtDay(m.prevTo)}`)}`,
    "",
    ...rows.map((r) => r.map(esc).join(",")),
    ...outcomes,
    ...services,
  ].join("\n");
}

export async function metricsXlsx(m: Metrics, opts: { followUps?: boolean } = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = m.scope === "org" && m.orgName ? m.orgName : "Impact report";
  const summary = wb.addWorksheet("Summary");
  summary.addRow(["Metrics", periodLabel(m)]);
  summary.addRow(["Compared with", `${fmtDay(m.prevFrom)} – ${fmtDay(m.prevTo)}`]);
  summary.addRow([]);
  summary.addRow(["Metric", "This period", "Previous period", "Change"]).font = { bold: true };
  for (const [k, label] of KPI_ROWS) summary.addRow([label, m.kpis[k], m.prev[k], change(m.kpis[k], m.prev[k])]);
  summary.getRow(1).font = { bold: true, size: 13 };
  summary.columns = [{ width: 32 }, { width: 16 }, { width: 16 }, { width: 10 }];

  for (const [title, points] of SECTIONS(m)) {
    if (m.scope === "org" && title.includes("visitors")) continue; // no client names in an organization report
    const ws = wb.addWorksheet(title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    ws.addRow([title.includes("visitors") ? "Person" : title.includes("reason") ? "Reason" : title.includes("Gender") ? "Gender" : title.includes("Ethnicity") ? "Ethnicity" : title.includes("Income") ? "Income level" : title.includes("week") ? "Day" : "Period", "Count"]).font = { bold: true };
    for (const p of points) ws.addRow([p.label, p.value]);
    ws.addRow(["Total", points.reduce((s, p) => s + p.value, 0)]).font = { bold: true };
    ws.columns = [{ width: 30 }, { width: 10 }];
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  // Newer sections: the written story, first visits vs returning, busiest times, follow-through.
  const story = wb.addWorksheet("Story");
  story.addRow([m.scope === "org" && m.orgName ? `${m.orgName}: ${periodLabel(m)}` : periodLabel(m)]).font = { bold: true, size: 13 };
  for (const line of buildStory(m, opts)) story.addRow([line]);
  story.columns = [{ width: 110 }];

  if (m.outcomes.length) {
    const out = wb.addWorksheet("Outcomes");
    out.addRow(["Outcome", "People", "Previous period"]).font = { bold: true };
    for (const o of m.outcomes) out.addRow([o.name, o.people, o.prevPeople]);
    out.addRow(["Reached any outcome", m.outcomePeople, m.prevOutcomePeople]).font = { bold: true };
    out.columns = [{ width: 30 }, { width: 10 }, { width: 16 }];
    out.views = [{ state: "frozen", ySplit: 1 }];
  }

  if (m.services.length) {
    const svc = wb.addWorksheet("Services");
    svc.addRow(["Service", "Times", "Previous period", "People", "Value ($)", "Busiest day", "Busiest time"]).font = { bold: true };
    for (const s of m.services) {
      svc.addRow([s.name, s.count, s.prevCount, s.people, s.valueCents / 100, s.busiestDay ?? "", s.busiestTime ? `${s.busiestTime}m` : ""]);
    }
    svc.addRow(["Total", m.services.reduce((n, s) => n + s.count, 0), "", "", m.services.reduce((n, s) => n + s.valueCents, 0) / 100]).font = { bold: true };
    svc.getColumn(5).numFmt = "$#,##0.00";
    svc.columns = [{ width: 28 }, { width: 8 }, { width: 16 }, { width: 8 }, { width: 12 }, { width: 13 }, { width: 13 }];
    svc.views = [{ state: "frozen", ySplit: 1 }];
  }

  const reach = wb.addWorksheet("People served");
  reach.addRow(["Period", "Returning", "First visit", "Total"]).font = { bold: true };
  for (const r of m.reach) reach.addRow([r.label, r.returning, r.first, r.returning + r.first]);
  reach.columns = [{ width: 16 }, { width: 12 }, { width: 12 }, { width: 10 }];
  reach.views = [{ state: "frozen", ySplit: 1 }];

  const heat = wb.addWorksheet("Busiest times");
  heat.addRow(["Day", ...HEATMAP_BLOCKS.map((b) => `${b}m`)]).font = { bold: true };
  m.heatmap.forEach((row, d) => heat.addRow([WEEKDAY_NAMES[d], ...row]));
  heat.columns = [{ width: 14 }, ...HEATMAP_BLOCKS.map(() => ({ width: 7 }))];

  if (opts.followUps) {
    const follow = wb.addWorksheet("Follow-through");
    follow.addRow(["Follow-ups due in the period", m.followThrough.due]).font = { bold: true };
    follow.addRow(["Done on time", m.followThrough.onTime]);
    follow.addRow(["Done late", m.followThrough.late]);
    follow.addRow(["Not done yet", m.followThrough.open]);
    follow.columns = [{ width: 32 }, { width: 10 }];
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export { impactPdf as metricsPdf } from "./impact-pdf";
