import { query } from "@/lib/db/client";
import { BACKUP_COLUMNS } from "@/lib/export/backup";

/**
 * Admin "Export everything" (Organization page → app/api/org/export): every record that
 * belongs to the organization, with who on staff it's assigned to or was logged by.
 * Never included: members' private contacts (org_id is null), tasks (private to their
 * owner, CLAUDE.md), team chats, and anything from another organization. Plain server
 * module: the route checks the caller is an active Admin and passes the org id.
 */
export const ORG_EXPORT_TABLES = [
  { table: "clients", label: "Clients" },
  { table: "visits", label: "Visits" }, // shown with the account's own word (lib/terms.ts)
  { table: "notes", label: "Notes" },
  { table: "outcomes", label: "Outcomes" },
  { table: "exits", label: "Exits" },
  { table: "services", label: "Services" },
  { table: "custom_fields", label: "Custom fields" },
  { table: "form_responses", label: "Form responses" },
] as const;
export type OrgExportTable = (typeof ORG_EXPORT_TABLES)[number]["table"];

const STAFF = `(select coalesce(u.name, u.email) from users u where u.id = %s)`;
const staff = (col: string) => STAFF.replace("%s", col);

export async function buildOrgExport(orgId: string): Promise<Record<OrgExportTable, Record<string, unknown>[]>> {
  const [clients, visits, notes, outcomes, exits, services, customFields, formResponses] = await Promise.all([
    query(
      `select ${BACKUP_COLUMNS.people.split(", ").map((c) => `p.${c}`).join(", ")}, ${staff("p.user_id")} as assigned_to
         from people p where p.org_id = $1 and p.deleted_at is null order by p.display_name`,
      [orgId],
    ),
    query(
      `select c.id, c.person_id, p.display_name as client, c.checked_in_at, c.reason, c.amount_cents, ${staff("c.user_id")} as logged_by, c.created_at
         from check_ins c left join people p on p.id = c.person_id
        where c.org_id = $1 and c.deleted_at is null order by c.checked_in_at`,
      [orgId],
    ),
    query(
      `select n.id, n.person_id, p.display_name as client, n.content, n.category, ${staff("n.user_id")} as written_by, n.created_at, n.updated_at
         from notes n left join people p on p.id = n.person_id
        where n.org_id = $1 and n.deleted_at is null order by n.created_at`,
      [orgId],
    ),
    query(
      `select po.id, po.person_id, p.display_name as client, o.name as outcome, to_char(po.achieved_on, 'YYYY-MM-DD') as achieved_on, po.note,
              ${staff("po.user_id")} as recorded_by, po.created_at
         from person_outcomes po join outcomes o on o.id = po.outcome_id left join people p on p.id = po.person_id
        where po.org_id = $1 and po.deleted_at is null order by po.achieved_on`,
      [orgId],
    ),
    query(
      `select pe.id, pe.person_id, p.display_name as client, r.name as reason, pe.kind as "group", to_char(pe.exited_on, 'YYYY-MM-DD') as exited_on,
              pe.note, pe.reopened_at as came_back_at, ${staff("pe.user_id")} as recorded_by, pe.created_at
         from person_exits pe join exit_reasons r on r.id = pe.reason_id left join people p on p.id = pe.person_id
        where pe.org_id = $1 and pe.deleted_at is null order by pe.exited_on`,
      [orgId],
    ),
    query(`select id, name, price_cents, archived_at, created_at from services where org_id = $1 order by position`, [orgId]),
    query(`select id, label, kind, options, archived_at from custom_fields where org_id = $1 order by position`, [orgId]),
    query(
      `select s.id, f.name as form, s.answers, s.fields, s.status, s.person_id, ${staff("s.user_id")} as assigned_to, s.created_at
         from form_submissions s join forms f on f.id = s.form_id
        where s.org_id = $1 and s.deleted_at is null order by s.created_at`,
      [orgId],
    ),
  ]);
  return {
    clients,
    visits,
    notes,
    outcomes,
    exits,
    services,
    custom_fields: customFields,
    form_responses: formResponses,
  };
}
