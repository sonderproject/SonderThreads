import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getMembership } from "@/lib/org";
import { getTimeZone } from "@/lib/timezone";
import { CONTENT_TYPES, fileStem, renderTable } from "@/lib/export/table";
import { STATUS_LABELS, formatDob, listReferrals } from "@/lib/referrals";

export const runtime = "nodejs";

function csvCell(v: string): string {
  // Leading = + - @ would run as a formula in Excel; prefix with a quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Admins: the referral log (?dept=&from=&to=) as Excel or CSV. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const m = await getMembership();
  if (!m?.active || m.role !== "admin") return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const p = new URL(request.url).searchParams;
  const format = p.get("format");
  if (format !== "xlsx" && format !== "csv") return NextResponse.json({ error: "format must be xlsx or csv" }, { status: 400 });
  const rows = await listReferrals(m.orgId, { dept: p.get("dept"), from: p.get("from"), to: p.get("to"), service: p.get("service") });
  const tz = await getTimeZone();
  const when = (v: string | null) =>
    v ? new Date(v).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz }) : "";

  const headers = ["Sent", "Client first name", "Client last name", "Phone", "Date of birth", "Referred by", "Department", "Referrer email", "Appointment", "Services", "Notes", "Outcome", "Decline reason", "Handled by", "Handled"];
  const body = rows.map((r) => [
    when(r.created_at),
    r.first_name,
    r.last_name,
    r.phone ?? "",
    formatDob(r.dob),
    r.referrer_name,
    r.referrer_department,
    r.referrer_email ?? "",
    r.appointment_at ? when(r.appointment_at) : r.waitlisted ? "Next opening" : "",
    (r.services ?? []).join(", "),
    r.notes ?? "",
    STATUS_LABELS[r.status],
    r.decline_reason ?? "",
    r.handled_by_name ?? "",
    when(r.handled_at),
  ]);
  const stem = `${fileStem(m.orgName, "organization")}-referrals`;

  if (format === "csv") {
    const csv = [headers, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${stem}.csv"`, "Cache-Control": "no-store" },
    });
  }
  const buf = await renderTable("xlsx", {
    title: `${m.orgName} referrals`,
    meta: `Exported ${new Date().toLocaleDateString("en-US", { timeZone: tz })} · ${rows.length} referrals`,
    headers,
    body,
  });
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": CONTENT_TYPES.xlsx, "Content-Disposition": `attachment; filename="${stem}.xlsx"`, "Cache-Control": "no-store" },
  });
}
