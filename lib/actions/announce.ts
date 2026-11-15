"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { recordMarketingChoice } from "@/lib/marketing";

/** Hides the current announcement banner for this person. */
export async function dismissAnnouncement(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = formData.get("id")?.toString() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await query(`update users set announcement_dismissed_id = $2 where id = $1`, [userId, id]);
  revalidatePath("/", "layout");
}

/** The one-time "tips and offers" question in the app: yes, or no thanks (never asked again either way). */
export async function answerMarketingPrompt(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const yes = formData.get("answer") === "yes";
  await recordMarketingChoice(userId, yes, "prompt");
  revalidatePath("/", "layout");
}

/** Settings → Notifications: turn marketing emails on or off. */
export async function setMarketingEmails(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await recordMarketingChoice(userId, formData.get("on") === "1", "settings");
  revalidatePath("/settings/notifications");
}
