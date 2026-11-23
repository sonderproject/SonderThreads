"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { assertCanWrite } from "@/lib/billing";
import { formFilter } from "@/lib/forms-scope";
import { builderData, previewWorkflow, workflowScope, type Preview } from "@/lib/workflows";
import { WORKFLOW_LIMITS, WORKFLOW_TEMPLATES, cleanWorkflow, isId, type Workflow } from "@/lib/workflows-shared";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

async function requireManager() {
  const s = await workflowScope();
  if (!s.canManage) redirect("/automations?error=manage");
  return s;
}

/** New automation, from a starter or blank. Starts off; it's turned on after it's checked. */
export async function createWorkflow(formData: FormData): Promise<void> {
  const s = await requireManager();
  await assertCanWrite();
  const { where, param } = formFilter(s);
  const n = await queryOne<{ n: number }>(`select count(*)::int as n from workflows where ${where} and deleted_at is null`, [param]);
  if ((n?.n ?? 0) >= WORKFLOW_LIMITS.perAccount) redirect("/automations?error=limit");
  const t = WORKFLOW_TEMPLATES.find((x) => x.key === formData.get("template"));
  const wf = t?.workflow ?? { trigger: { type: "person_added" }, conditions: [], actions: [{ type: "create_task", title: "Follow up with {name}", dueDays: 1, assignee: "owner" }] };
  const row = await queryOne<{ id: string }>(
    `insert into workflows (user_id, org_id, name, trigger, conditions, actions, template) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [s.userId, s.orgId, t?.name ?? "New automation", JSON.stringify(wf.trigger), JSON.stringify(wf.conditions), JSON.stringify(wf.actions), t?.key ?? null],
  );
  revalidatePath("/automations");
  redirect(`/automations/${row!.id}`);
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Saves the builder. Every id is checked against the signed-in person's account. Whoever
 * saves becomes the automation's owner (its lists and "me" refer to them).
 */
export async function saveWorkflow(id: string, data: { name: unknown; workflow: unknown; enabled?: boolean }): Promise<SaveResult> {
  const s = await workflowScope();
  if (!s.canManage) return { ok: false, error: "Only Admins and Managers can change automations." };
  if (!isId(id)) return { ok: false, error: "That automation no longer exists." };
  try {
    await assertCanWrite();
  } catch {
    return { ok: false, error: "Your account is read-only right now." };
  }
  const name = clean(data.name, WORKFLOW_LIMITS.nameLength);
  if (!name) return { ok: false, error: "Give the automation a name." };
  let wf: Workflow;
  try {
    wf = cleanWorkflow(data.workflow, (await builderData(s)).ctx);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const { where, param } = formFilter(s);
  const enable = data.enabled === true;
  const row = await queryOne<{ id: string }>(
    `update workflows set name = $3, trigger = $4, conditions = $5, actions = $6, user_id = $7, updated_at = now(),
            enabled = case when $8 then true else enabled end,
            enabled_at = case when $8 and not enabled then now() else enabled_at end
      where ${where} and id = $2 and deleted_at is null returning id`,
    [param, id, name, JSON.stringify(wf.trigger), JSON.stringify(wf.conditions), JSON.stringify(wf.actions), s.userId, enable],
  );
  if (!row) return { ok: false, error: "That automation no longer exists." };
  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  return { ok: true };
}

/** Turn on or off. Turning on re-checks the rule against the account as it is now. */
export async function setWorkflowEnabled(formData: FormData): Promise<void> {
  const s = await requireManager();
  await assertCanWrite();
  const id = formData.get("id");
  const on = formData.get("enabled") === "1";
  const { where, param } = formFilter(s);
  const wf = isId(id)
    ? await queryOne<{ trigger: unknown; conditions: unknown; actions: unknown }>(`select trigger, conditions, actions from workflows where ${where} and id = $2 and deleted_at is null`, [param, id])
    : null;
  if (!wf) redirect("/automations?error=gone");
  if (on) {
    try {
      cleanWorkflow(wf, (await builderData(s)).ctx);
    } catch (e) {
      redirect(`/automations/${id}?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
    }
  }
  await query(
    `update workflows set enabled = $3, enabled_at = case when $3 and not enabled then now() else enabled_at end, updated_at = now()
      where ${where} and id = $2`,
    [param, id, on],
  );
  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  redirect(`/automations/${id}?saved=${on ? "on" : "off"}`);
}

export async function deleteWorkflow(formData: FormData): Promise<void> {
  const s = await requireManager();
  const id = formData.get("id");
  const { where, param } = formFilter(s);
  if (isId(id)) await query(`update workflows set deleted_at = now(), enabled = false where ${where} and id = $2`, [param, id]);
  revalidatePath("/automations");
  redirect("/automations?saved=deleted");
}

/** "Test this rule": who it would have matched. Reads only; nothing is created or sent. */
export async function testWorkflow(data: { workflow: unknown }): Promise<{ ok: true; preview: Preview } | { ok: false; error: string }> {
  const s = await workflowScope();
  if (!s.canManage) return { ok: false, error: "Only Admins and Managers can test automations." };
  try {
    const wf = cleanWorkflow(data.workflow, (await builderData(s)).ctx);
    return { ok: true, preview: await previewWorkflow(s, wf) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
