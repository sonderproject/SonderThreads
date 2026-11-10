"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { normalizePhone } from "@/lib/notify/phone";
import { phoneTaken } from "@/lib/phone-unique";

const MAX_NAME_LENGTH = 80;

/** Settings → Account: name and mobile number. Clearing the number also turns texts off. */
export async function saveProfile(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = (formData.get("name")?.toString() ?? "").trim().slice(0, MAX_NAME_LENGTH) || null;
  const raw = formData.get("phone")?.toString() ?? "";
  const phone = raw.trim() ? normalizePhone(raw) : null;
  if (raw.trim() && !phone) redirect("/settings?error=phone#account");
  if (phone && (await phoneTaken(phone, userId))) redirect("/settings?error=phone-used#account");
  await query(
    `update users set name = $1, phone = $2, sms_opt_in = sms_opt_in and $2::text is not null, updated_at = now()
      where id = $3`,
    [name, phone, userId],
  );
  revalidatePath("/settings");
  redirect("/settings?saved=profile#account");
}

/** Home welcome checklist: hide it for good. */
export async function dismissWelcome(): Promise<void> {
  const userId = await requireUserId();
  await query(`update users set welcome_dismissed_at = now() where id = $1`, [userId]);
  revalidatePath("/");
}

/** Home welcome checklist: the "put it on your phone" step is done. */
export async function markWelcomePhoneDone(): Promise<void> {
  const userId = await requireUserId();
  await query(`update users set welcome_phone_done = true where id = $1`, [userId]);
  revalidatePath("/");
}
