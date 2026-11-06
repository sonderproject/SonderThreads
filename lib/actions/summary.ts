"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/current-user";
import { regenerateSummaryFor } from "@/lib/summary-core";

/** Regenerates a person's short summary + current/next fields from their recent notes and open tasks. */
export async function regeneratePersonSummary(personId: string): Promise<void> {
  const userId = await requireUserId();
  await regenerateSummaryFor(userId, personId);
  revalidatePath(`/people/${personId}`);
  revalidatePath("/people");
  revalidatePath("/");
}
