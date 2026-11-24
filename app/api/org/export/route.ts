import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { query, queryOne } from "@/lib/db/client";
import { logEvent } from "@/lib/events";
import { ORG_EXPORT_TABLES, buildOrgExport, type OrgExportTable } from "@/lib/export/org-export";
import { getSessionUser } from "@/lib/session";
import { takeQuota } from "@/lib/usage";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(typeof r[h] === "object" && r[h] !== null ? JSON.stringify(r[h]) : r[h])).join(","))].join("\n");
}

/**
 * Organization Admins only: download everything the organization owns (lib/export/org-export.ts),
 * as one JSON file or one CSV per table (?format=csv&table=clients). Every download is written
 * to the organization's activity log (Team → Activity log) and the owner's event log.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const m = await queryOne<{ org_id: string; name: string }>(
    `select m.org_id, o.name from memberships m join organizations o on o.id = m.org_id where m.user_id = $1 and m.active and m.role = 'admin'`,
    [user.id],
  );
  if (!m) return NextResponse.json({ error: "Only your organization's Admins can export everything." }, { status: 403 });
  if (!(await takeQuota(user.id, "export"))) {
    return NextResponse.json({ error: "Too many exports in a short time. Try again in a little while." }, { status: 429 });
  }

  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "csv" ? "csv" : "json";
  const table = params.get("table") as OrgExportTable | null;
  if (format === "csv" && !ORG_EXPORT_TABLES.some((t) => t.table === table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  const data = await buildOrgExport(m.org_id);
  const what = format === "csv" ? table! : "everything";
  await query(
    `insert into audit_log (org_id, actor_id, action, table_name, fields) values ($1, $2, 'export', 'organization', $3)`,
    [m.org_id, user.id, [what]],
  ).catch(() => undefined);
  await logEvent("org.export", `Organization export (${what})`, { meta: { org: m.org_id, by: user.id, format } }).catch(() => undefined);

  const day = new Date().toISOString().slice(0, 10);
  const stem = `surfdesk-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "organization"}`;
  if (format === "csv") {
    return new NextResponse(toCsv(data[table!]), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${stem}-${table!.replace("_", "-")}-${day}.csv"` },
    });
  }
  const payload = { exported_at: new Date().toISOString(), organization: m.name, ...data };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${stem}-export-${day}.json"` },
  });
}
