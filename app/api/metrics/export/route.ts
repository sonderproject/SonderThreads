import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getTimeZone } from "@/lib/timezone";
import { dayKey } from "@/lib/tz";
import { computeMetrics, normalizeRange } from "@/lib/metrics";
import { metricsCsv, metricsPdf, metricsXlsx } from "@/lib/export/metrics-report";
import { CONTENT_TYPES } from "@/lib/export/table";
import { reportableOrg } from "@/lib/actions/metrics";
import { asUser } from "@/lib/db/as-user";
import type { ReportOrgInfo } from "@/lib/export/impact-pdf";

// pdfkit and exceljs need Node APIs (fs, streams).
export const runtime = "nodejs";

/** Metrics for ?from=&to= (local days, inclusive; &scope=org for the organization) as a PDF report, Excel workbook or CSV. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  if (format !== "pdf" && format !== "xlsx" && format !== "csv") {
    return NextResponse.json({ error: "format must be pdf, xlsx or csv" }, { status: 400 });
  }
  const tz = await getTimeZone();
  const { from, to } = normalizeRange(params.get("from"), params.get("to"), dayKey(new Date(), tz));
  const followUps = params.get("followups") === "1"; // optional section, off unless asked for
  const org = params.get("scope") === "org" ? await reportableOrg() : null;
  if (params.get("scope") === "org" && !org) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const metrics = await computeMetrics(user.id, tz, from, to, org);
  const disposition = `attachment; filename="${format === "pdf" ? "impact-report" : "metrics"}-${from}-to-${to}.${format}"`;

  if (format === "csv") {
    return new NextResponse(metricsCsv(metrics), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": disposition },
    });
  }
  const orgInfo =
    format === "pdf" && org
      ? (
          await asUser(user.id, (q) =>
            q<ReportOrgInfo>(`select about, phone, email, website, address, logo from organizations where id = $1`, [org.id]),
          )
        )[0] ?? null
      : null;
  const file =
    format === "pdf"
      ? await metricsPdf(metrics, { preparedFor: user.name || user.email, org: orgInfo, followUps })
      : await metricsXlsx(metrics, { followUps });
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": CONTENT_TYPES[format], "Content-Disposition": disposition },
  });
}
