import { query, queryOne } from "@/lib/db/client";
import { scopeFilter, serviceScope } from "@/lib/services";
import type { CustomField, FieldKind } from "@/lib/custom-fields-shared";

/**
 * Custom fields: extra details a business tracks on each person. Same scope as
 * services and outcomes: an organization shares one list its admins manage; a
 * solo account has its own. Values are stored on people.custom_fields, keyed by
 * field id; retiring a field hides it but keeps what was entered.
 */
export const customFieldScope = serviceScope;

type Row = { id: string; label: string; kind: FieldKind; options: string[] | null; archived_at: string | null };

const toField = (r: Row): CustomField => ({ id: r.id, label: r.label, kind: r.kind, options: r.options ?? [], archived: r.archived_at !== null });

export async function listCustomFields(opts: { includeArchived?: boolean } = {}): Promise<CustomField[]> {
  const scope = await customFieldScope();
  const { where, param } = scopeFilter(scope);
  const rows = await query<Row>(
    `select id, label, kind, options, archived_at from custom_fields
      where ${where} ${opts.includeArchived ? "" : "and archived_at is null"}
      order by archived_at nulls first, position, lower(label)`,
    [param],
  );
  return rows.map(toField);
}

/** An active field in the signed-in person's list, or null. */
export async function findCustomField(id: string): Promise<CustomField | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const scope = await customFieldScope();
  const { where, param } = scopeFilter(scope);
  const r = await queryOne<Row>(`select id, label, kind, options, archived_at from custom_fields where ${where} and id = $2 and archived_at is null`, [param, id]);
  return r ? toField(r) : null;
}
