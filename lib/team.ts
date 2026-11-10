import { notFound } from "next/navigation";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership, type OrgRole } from "@/lib/org";

/**
 * The Team pages are for an organization's active admins and supervisors.
 * Everything they show is read through asUser(), so the database's access
 * rules decide what's visible (organization clients only, never anyone's
 * personal records). Anyone else gets a plain 404.
 */
export async function requireTeamViewer(): Promise<{ userId: string; orgId: string; orgName: string; role: OrgRole }> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active || (m.role !== "admin" && m.role !== "supervisor")) notFound();
  return { userId, orgId: m.orgId, orgName: m.orgName, role: m.role };
}

/** Any active organization member: for viewing a shared client record. */
export async function requireOrgMember(): Promise<{ userId: string; orgId: string; orgName: string; role: OrgRole }> {
  const userId = await requireUserId();
  const m = await getMembership();
  if (!m?.active) notFound();
  return { userId, orgId: m.orgId, orgName: m.orgName, role: m.role };
}

/** "Nov 9" / "Nov 9, 2025" in the viewer's time zone. */
export function shortDate(value: string | Date | null, timeZone: string): string {
  if (!value) return "";
  const d = new Date(value);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric", timeZone });
}

/** Records that a supervisor or admin opened a client's record (for the audit log). */
export async function logClientView(orgId: string, viewerId: string, personId: string): Promise<void> {
  await query(
    `insert into audit_log (org_id, actor_id, action, table_name, record_id, person_id) values ($1, $2, 'view', 'people', $3, $3)`,
    [orgId, viewerId, personId],
  ).catch((err) => console.error("[audit] couldn't record a view", err instanceof Error ? err.message : err));
}
