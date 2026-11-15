import { requireOwner, logOwnerAction } from "@/lib/owner";
import { query } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** CSV text cell, safe to open in Excel/Sheets (no formula injection). */
function cell(v: string | null): string {
  const s = (v ?? "").replace(/^[=+\-@\t\r]/, "'$&");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Command center → Growth: the opted-in marketing list (email, name, when and where they opted in). */
export async function GET() {
  await requireOwner();
  const rows = await query<{ email: string; name: string | null; opted_in_at: string; source: string }>(
    `select u.email, u.name, c.created_at as opted_in_at, c.source
       from users u
       join lateral (select created_at, source from marketing_consents mc where mc.user_id = u.id order by created_at desc limit 1) c on true
      where u.marketing_opt_in and u.suspended_at is null
      order by c.created_at desc`,
  );
  await logOwnerAction("marketing_export", `Downloaded the marketing list (${rows.length} emails)`);
  const csv = ["email,name,opted_in_at,source", ...rows.map((r) => [cell(r.email), cell(r.name), new Date(r.opted_in_at).toISOString(), r.source].join(","))].join("\n");
  return new Response(`${csv}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="surfdesk-marketing-list-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
