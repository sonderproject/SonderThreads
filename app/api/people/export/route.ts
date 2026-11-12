import { NextResponse } from "next/server";
import { exportFilter } from "@/lib/db/scope";
import { csvCell } from "@/lib/csv";
import { query } from "@/lib/db/client";
import { getSessionUser } from "@/lib/session";
import { CONTENT_TYPES, renderTable } from "@/lib/export/table";
import { fuzzyFilter } from "@/lib/fuzzy";
import { NO_BIRTH_YEAR } from "@/lib/parse-person-line";
import type { Person } from "@/lib/types";

// pdfkit and exceljs need Node APIs (fs, streams).
export const runtime = "nodejs";

const FORMATS = ["pdf", "xlsx", "csv"] as const;
type Format = (typeof FORMATS)[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** node-postgres returns `date` as a local-midnight Date; show "May 12, 2008" (or "May 12" when saved without a year). */
function formatBirthday(value: string | Date | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00`) : value;
  const y = d.getFullYear();
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return y === NO_BIRTH_YEAR ? base : `${base}, ${y}`;
}


/**
 * People roster as PDF, Excel or CSV, in the order the People page shows
 * (most recent activity first). ?q= applies the same typo-tolerant search as
 * the page's search box, so a filtered export matches the screen.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format") as Format;
  if (!FORMATS.includes(format)) {
    return NextResponse.json({ error: "format must be pdf, xlsx or csv" }, { status: 400 });
  }
  const q = params.get("q")?.trim() ?? "";

  const all = await query<Person>(
    `select id, display_name, phone, email, birthday, gender, ethnicity, income_level, current_status, next_action, needs_followup, last_activity_at, summary
       from people where ${await exportFilter(user.id, "$1")} and deleted_at is null
      order by last_activity_at desc`,
    [user.id],
  );
  const people = q
    ? fuzzyFilter(all, q, (c) => [
        { text: c.display_name, weight: 1 },
        { text: c.current_status, weight: 0.8 },
        { text: c.next_action, weight: 0.8 },
        { text: c.summary, weight: 0.7 },
      ])
    : all;

  const headers = ["Name", "Phone", "Email", "Birthday", "Gender", "Ethnicity", "Income", "Current", "Next", "Follow up"];
  const body = people.map((p) => [
    p.display_name,
    p.phone ?? "",
    p.email ?? "",
    formatBirthday(p.birthday as string | Date | null),
    p.gender ?? "",
    p.ethnicity ?? "",
    p.income_level ?? "",
    p.current_status ?? "",
    p.next_action ?? "",
    p.needs_followup ? "Yes" : "",
  ]);

  const exportedOn = new Date().toISOString().slice(0, 10);
  const disposition = `attachment; filename="people-${exportedOn}.${format}"`;

  if (format === "csv") {
    const csv = [headers, ...body].map((r) => r.map(csvCell).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": disposition },
    });
  }

  const file = await renderTable(format, {
    title: "People",
    description: q ? `Matching "${q}"` : null,
    meta: `Exported ${exportedOn} · ${body.length} ${body.length === 1 ? "person" : "people"}`,
    headers,
    body,
    // Name, phone, birthday and follow-up are short; email/current/next share the rest.
    fixedWidths: { 0: 90, 1: 72, 3: 62, 4: 48, 6: 46, 9: 42 },
    emptyMessage: "No people.",
  });

  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": CONTENT_TYPES[format], "Content-Disposition": disposition },
  });
}
