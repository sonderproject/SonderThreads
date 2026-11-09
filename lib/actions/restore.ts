"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/current-user";
import { toActionResult, type ActionResult } from "@/lib/validation";
import { countsOf, parseBackup, restoreInto, type RestoreCounts } from "@/lib/restore-core";

export type { RestoreCounts } from "@/lib/restore-core";

/** Settings → Data → Import backup: checks a file and returns what it holds, for the preview. */
export async function previewBackup(raw: unknown): Promise<ActionResult<RestoreCounts>> {
  return toActionResult(async () => {
    await requireUserId();
    return countsOf(parseBackup(raw));
  });
}

/** Restores a backup file into the signed-in account, all or nothing. */
export async function restoreBackup(raw: unknown): Promise<ActionResult<RestoreCounts>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    const added = await restoreInto(userId, parseBackup(raw));
    revalidatePath("/", "layout");
    return added;
  });
}
