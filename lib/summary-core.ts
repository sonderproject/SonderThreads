import { query, queryOne } from "@/lib/db/client";
import { generatePersonSummary } from "@/lib/ai/person-summary";
import type { Person } from "@/lib/types";

/**
 * Plain server module (not "use server"), so it isn't callable from the
 * browser: the user id is passed in by trusted server code. Lets a note save
 * run the summary after the response (next/server after()), where request
 * cookies may not be available.
 *
 * Regenerates a person's short summary + current/next fields from their
 * recent notes and open tasks.
 */
export async function regenerateSummaryFor(userId: string, personId: string): Promise<void> {
  const person = await queryOne<Person>(
    `select * from people where user_id = $1 and id = $2 and deleted_at is null`,
    [userId, personId],
  );

  if (!person) return;

  const [notes, tasks] = await Promise.all([
    query<{ content: string; created_at: string }>(
    `select content, created_at from notes
     where user_id = $1 and person_id = $2 and deleted_at is null
     order by created_at desc
     limit 5`,
    [userId, personId],
    ),
    query<{ title: string; due_at: string | null }>(
    `select title, due_at from tasks
     where user_id = $1 and person_id = $2 and completed = false and deleted_at is null
     order by due_at asc nulls last
     limit 5`,
    [userId, personId],
    ),
  ]);

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
      userId,
      personId,
    ],
  );

  if (result.summary) {
    await query(
      `insert into person_summaries (user_id, person_id, summary, generated_by) values ($1, $2, $3, $4)`,
      [userId, personId, result.summary, result.generatedBy],
    );
  }

}
