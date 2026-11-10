"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/current-user";
import { clearUserData } from "@/lib/clear-data-core";

/**
 * Settings → Data → Clear my data: deletes the signed-in person's own
 * records (people, notes, tasks, lists, check-ins, history, notifications)
 * in one transaction. Organization clients and anything attached to them are
 * never deleted here: they belong to the agency. The account, settings and
 * organization membership stay.
 */
export async function clearMyData(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  if (formData.get("confirm")?.toString().trim() !== "CLEAR") redirect("/settings?error=clear-confirm#clear");

  await clearUserData(userId);
  revalidatePath("/", "layout");
  redirect("/settings?saved=cleared#clear");
}
