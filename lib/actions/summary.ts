"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { generatePersonSummary } from "@/lib/ai/person-summary";
import type { Person } from "@/lib/types";

/** Regenerates a person's short summary + current/next fields from their recent notes and open tasks. */
export async function regeneratePersonSummary(personId: string): Promise<void> {
  const person = await queryOne<Person>(
    `select * from people where user_id = $1 and id = $2 and deleted_at is null`,
    [OWNER_ID, personId],
  );

  if (!person) return;

  const notes = await query<{ content: string; created_at: string }>(
    `select content, created_at from notes
     where user_id = $1 and person_id = $2 and deleted_at is null
     order by created_at desc
     limit 5`,
    [OWNER_ID, personId],
  );

  const tasks = await query<{ title: string; due_at: string | null }>(
    `select title, due_at from tasks
     where user_id = $1 and person_id = $2 and completed = false and deleted_at is null
     order by due_at asc nulls last
     limit 5`,
    [OWNER_ID, personId],
  );

  const result = await generatePersonSummary({
    person: {
      displayName: person.display_name,
      currentStatus: person.current_status,
      nextAction: person.next_action,
    },
    recentNotes: notes.map((n) => ({ content: n.content, createdAt: n.created_at })),
    openTasks: tasks.map((t) => ({ title: t.title, dueAt: t.due_at })),
  });

  await query(
    `update people set summary = $1, current_status = $2, next_action = $3
     where user_id = $4 and id = $5 and deleted_at is null`,
    [
      result.summary || person.summary,
      result.currentStatus ?? person.current_status,
      result.nextAction ?? person.next_action,
      OWNER_ID,
      personId,
    ],
  );

  if (result.summary) {
    await query(
      `insert into person_summaries (user_id, person_id, summary, generated_by) values ($1, $2, $3, $4)`,
      [OWNER_ID, personId, result.summary, result.generatedBy],
    );
  }

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people");
  revalidatePath("/");
}
