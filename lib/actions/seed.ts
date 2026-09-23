"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "./helpers";
import { createClientRecord } from "./clients";
import { createNote } from "./notes";
import { createTask } from "./tasks";
import { createList, addNamesToList } from "./lists";

/**
 * Populates demo clients/notes/tasks/a cohort list the first time a (new,
 * anonymous) user opens the app with an empty account, so the dashboard
 * isn't blank on first run. No-ops for anyone who already has data.
 */
export async function seedDemoDataIfEmpty(): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const todayNoon = new Date();
  todayNoon.setHours(12, 0, 0, 0);

  const marcus = await createClientRecord({
    fullName: "Marcus Johnson",
    currentStatus: "Starts Amazon Monday",
    nextAction: "Follow up after first week",
  });
  const james = await createClientRecord({
    fullName: "James Smith",
    currentStatus: "Guard card completed",
    nextAction: "Apply for security positions",
  });
  const wes = await createClientRecord({
    fullName: "Wes Carter",
    currentStatus: "Interview scheduled",
    nextAction: "Follow up after interview",
  });

  const cohort7 = await createList({ name: "Cohort 7", isCohort: true });
  await addNamesToList(cohort7.id, true, ["Marcus Johnson", "James Smith", "Wes Carter"]);

  await createNote({
    content: "Marcus said he starts Amazon Monday.",
    clientId: marcus.id,
    category: "employment",
  });
  await createNote({
    content: "James got his guard card today.",
    clientId: james.id,
    category: "certification",
  });
  await createNote({
    content: "Wes has an interview scheduled — prepping his resume.",
    clientId: wes.id,
    category: "employment",
  });
  await createNote({
    content: "Need to ask supervisor about transportation cards.",
  });

  await createTask({ title: "Call Marcus about interview", clientId: marcus.id, dueAt: todayNoon.toISOString() });
  await createTask({ title: "Send James onboarding paperwork", clientId: james.id, dueAt: todayNoon.toISOString() });
  await createTask({ title: "Check Wes certification", clientId: wes.id, dueAt: todayNoon.toISOString() });
}
