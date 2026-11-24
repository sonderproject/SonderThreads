"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { assertCanWrite } from "@/lib/billing";
import { AUTOMATIONS } from "@/lib/automations";

/** Settings → Automations: turn each rule on or off and set its timing. Rules only ever make tasks for you. */
export async function saveAutomations(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await assertCanWrite();
  for (const a of AUTOMATIONS) {
    const on = formData.get(`${a.kind}_on`) === "1";
    const days = Number(formData.get(`${a.kind}_days`));
    const d = a.days.includes(days) ? days : a.defaultDays;
    // Turning a rule on (again) restarts its clock, so it only acts on what happens from now on where that matters.
    await query(
      `insert into automation_rules (user_id, kind, enabled, days) values ($1, $2, $3, $4)
       on conflict (user_id, kind) do update set
         created_at = case when not automation_rules.enabled and excluded.enabled then now() else automation_rules.created_at end,
         enabled = excluded.enabled, days = excluded.days, updated_at = now()`,
      [userId, a.kind, on, d],
    );
  }
  revalidatePath("/settings/automations");
  revalidatePath("/automations");
  // Business accounts save these on the Automations page; individuals in Settings.
  if (formData.get("back") === "/automations") redirect("/automations?saved=followups");
  redirect("/settings/automations?saved=automations");
}
