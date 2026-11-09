import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { query } from "@/lib/db/client";
import { getSessionUser } from "@/lib/session";
import { CONTENT_TYPES, renderTable } from "@/lib/export/table";
import { fuzzyMatcher } from "@/lib/fuzzy";

// pdfkit and exceljs need Node APIs (fs, streams).
export const runtime = "nodejs";

type Row = { display_name: string; checked_in_at: Date; reason: string | null };

const FORMATS = ["pdf", "xlsx", "csv"] as const;
type Format = (typeof FORMATS)[number];

function validTimeZone(tz: string | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

function validInstant(value: string | null): string | null {
  return value && !Number.isNaN(Date.parse(value)) ? value : null;
}


/**
 * Check-in log as PDF, Excel or CSV. Takes the same filters as the
 * Check-ins page: q (name or reason), from/to (ISO instants, `to` exclusive)
 * and tz (the viewer's IANA zone, so dates and times print as they see them).
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format") as Format;
  if (!FORMATS.includes(format)) {
    return NextResponse.json({ error: "format must be pdf, xlsx or csv" }, { status: 400 });
  }
  const tz = validTimeZone(params.get("tz"));
  const q = params.get("q")?.trim() || null;
  const from = validInstant(params.get("from"));
  const to = validInstant(params.get("to"));

  const allRows = await query<Row>(
    `select p.display_name, c.checked_in_at, c.reason
       from check_ins c
       join people p on p.id = c.person_id and p.deleted_at is null
      where c.user_id = $1
        and c.deleted_at is null
        and ($2::timestamptz is null or c.checked_in_at >= $2::timestamptz)
        and ($3::timestamptz is null or c.checked_in_at < $3::timestamptz)
      order by c.checked_in_at desc`,
    [user.id, from, to],
  );
  // Same typo-tolerant match as the Check-ins page, so the file matches the screen.
  const matches = fuzzyMatcher(q ?? "");
  const rows = allRows.filter((r) => matches([{ text: r.display_name, weight: 1 }, { text: r.reason, weight: 1 }]) > 0);

  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "short", day: "numeric", weekday: "short" });
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const headers = ["Date", "Time", "Name", "Reason"];
  const body = rows.map((r) => [
    date.format(new Date(r.checked_in_at)),
    time.format(new Date(r.checked_in_at)),
    r.display_name,
    r.reason ?? "",
  ]);

  const exportedOn = new Date().toISOString().slice(0, 10);
  const filename = `check-ins-${exportedOn}.${format}`;
  const disposition = `attachment; filename="${filename}"`;

  if (format === "csv") {
    const csv = [headers, ...body].map((r) => r.map(csvCell).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": disposition },
    });
  }

  const filters = [
    q && `matching "${q}"`,
    from && `from ${date.format(new Date(from))}`,
    to && `to ${date.format(new Date(new Date(to).getTime() - 1))}`,
  ].filter(Boolean);
  const file = await renderTable(format, {
    title: "Check-ins",
    description: filters.length ? `Showing check-ins ${filters.join(" ")}` : null,
    meta: `Exported ${exportedOn} · ${body.length} check-ins`,
    headers,
    body,
    fixedWidths: { 0: 120, 1: 60, 2: 150 },
    emptyMessage: "No check-ins.",
  });

  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": CONTENT_TYPES[format], "Content-Disposition": disposition },
  });
}
