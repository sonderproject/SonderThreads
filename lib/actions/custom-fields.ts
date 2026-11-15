"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { actorQueryOne, mineOrOrg } from "@/lib/db/scope";
import { requireUserId } from "@/lib/current-user";
import { assertCanWrite } from "@/lib/billing";
import { scopeFilter } from "@/lib/services";
import { customFieldScope, findCustomField } from "@/lib/custom-fields";
import {
  MAX_FIELDS,
  MAX_OPTIONS,
  cleanFieldValue,
  isFieldKind,
  type CustomField,
} from "@/lib/custom-fields-shared";
import { toActionResult, type ActionResult } from "@/lib/validation";

async function manageable() {
  const scope = await customFieldScope();
  if (!scope.canManage) throw new Error("Only your organization's admins can change the custom fields.");
  await assertCanWrite();
  return scope;
}

function cleanLabel(label: string): string {
  const l = label.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!l) throw new Error("Give the field a name.");
  return l;
}

function cleanOptions(raw: string[] | undefined): string[] {
  const out: string[] = [];
  for (const o of raw ?? []) {
    const v = o.trim().replace(/\s+/g, " ").slice(0, 60);
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  if (out.length > MAX_OPTIONS) throw new Error(`Up to ${MAX_OPTIONS} options.`);
  return out;
}

function refresh() {
  revalidatePath("/settings/fields");
  revalidatePath("/people", "layout");
}

export async function addCustomField(params: { label: string; kind: string; options?: string[] }): Promise<ActionResult<CustomField>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const label = cleanLabel(params.label);
    if (!isFieldKind(params.kind)) throw new Error("Choose a type.");
    const options = params.kind === "choice" ? cleanOptions(params.options) : [];
    if (params.kind === "choice" && options.length < 2) throw new Error("Add at least two options to pick from.");
    const info = await queryOne<{ n: number; dupe: boolean | null; pos: number }>(
      `select count(*) filter (where archived_at is null)::int as n,
              bool_or(archived_at is null and lower(label) = lower($2)) as dupe,
              coalesce(max(position), 0) + 1 as pos
         from custom_fields where ${where}`,
      [param, label],
    );
    if (info?.dupe) throw new Error(`"${label}" is already a field.`);
    if ((info?.n ?? 0) >= MAX_FIELDS) throw new Error(`You can have up to ${MAX_FIELDS} custom fields.`);
    const row = await queryOne<{ id: string }>(
      `insert into custom_fields (org_id, user_id, label, kind, options, position) values ($1, $2, $3, $4, $5, $6) returning id`,
      [scope.orgId, scope.orgId ? null : scope.userId, label, params.kind, options.length ? options : null, info?.pos ?? 1],
    );
    refresh();
    return { id: row!.id, label, kind: params.kind, options, archived: false };
  });
}

/** Rename a field, or change a pick-list's options (values already entered stay as they are). */
export async function updateCustomField(id: string, params: { label: string; options?: string[] }): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const label = cleanLabel(params.label);
    const field = await queryOne<{ kind: string }>(`select kind from custom_fields where ${where} and id = $2`, [param, id]);
    if (!field) throw new Error("That field isn't on your list.");
    const dupe = await queryOne(`select 1 from custom_fields where ${where} and archived_at is null and lower(label) = lower($2) and id <> $3`, [param, label, id]);
    if (dupe) throw new Error(`"${label}" is already a field.`);
    const options = field.kind === "choice" ? cleanOptions(params.options) : null;
    if (options && options.length < 2) throw new Error("Keep at least two options.");
    await query(`update custom_fields set label = $3, options = coalesce($4, options) where ${where} and id = $2`, [param, id, label, options]);
    refresh();
    return null;
  });
}

/** Retire (or bring back) a field. Values entered stay on people, hidden while it's retired. */
export async function setCustomFieldArchived(id: string, archived: boolean): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    if (!archived) {
      const n = await queryOne<{ n: number }>(`select count(*)::int as n from custom_fields where ${where} and archived_at is null`, [param]);
      if ((n?.n ?? 0) >= MAX_FIELDS) throw new Error(`You can have up to ${MAX_FIELDS} custom fields.`);
    }
    await query(`update custom_fields set archived_at = ${archived ? "now()" : "null"} where ${where} and id = $2`, [param, id]);
    refresh();
    return null;
  });
}

export async function moveCustomField(id: string, direction: -1 | 1): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    const scope = await manageable();
    const { where, param } = scopeFilter(scope);
    const rows = await query<{ id: string }>(`select id from custom_fields where ${where} and archived_at is null order by position, lower(label)`, [param]);
    const i = rows.findIndex((r) => r.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= rows.length) return null;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [pos, r] of rows.entries()) await query(`update custom_fields set position = $3 where ${where} and id = $2`, [param, r.id, pos + 1]);
    refresh();
    return null;
  });
}

/** Sets (or clears) one custom field on a person anyone with access to the person can edit. */
export async function setPersonField(personId: string, fieldId: string, raw: string): Promise<ActionResult<{ value: string | null }>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    await assertCanWrite();
    const field = await findCustomField(fieldId);
    if (!field) throw new Error("That field isn't on your list anymore.");
    const value = cleanFieldValue(field, raw.slice(0, 1000));
    const row = await actorQueryOne<{ id: string }>(
      userId,
      `update people set custom_fields = ${value === null ? "custom_fields - $3" : "jsonb_set(custom_fields, array[$3], to_jsonb($4::text))"},
              updated_at = now()
        where ${mineOrOrg("$1")} and id = $2 and deleted_at is null returning id`,
      value === null ? [userId, personId, field.id] : [userId, personId, field.id, value],
    );
    if (!row) throw new Error("Person not found.");
    revalidatePath(`/people/${personId}`);
    return { value };
  });
}
