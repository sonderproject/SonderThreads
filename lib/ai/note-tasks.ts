import { extractDate } from "@/lib/ai/date";
import { splitCommands } from "@/lib/ai/split";
import { ACTION_VERB, findMentionedPerson } from "@/lib/ai/providers/fallback";
import type { KnownPerson } from "@/lib/ai/providers/types";

/** "I need to…", "remember to…", "todo: …" — whatever follows is a to-do. */
const LEAD =
  /^(?:(?:i|we)\s+)?(?:(?:really|still|also|definitely)\s+)?(?:need to|have to|gotta|got to|must|should|want to)\s+|^(?:please\s+)?(?:remember to|don'?t forget to|do not forget to|make sure to|remind me to)\s+|^(?:todo|to-?do|task|action item|next step)s?\s*[:\-]\s*/i;

/** To-do verbs common in notes that the command bar's list doesn't cover. */
const NOTE_VERB =
  /^(talk|speak|chat|discuss|connect|catch up|touch base|circle back|sit down|set up|line up|look into|figure out|find out|research|plan|invite|introduce|contact|hire|interview|onboard|update)\b/i;

const MAX_TASKS_PER_NOTE = 5;

export type NoteTask = { title: string; dueAt: string | null; personId: string | null };

/**
 * Pulls the to-dos out of a note, one per sentence that reads like one:
 * "Marcus got hired. Talk to Marcus about getting more clients downtown
 * Friday." → one task, "Talk to Marcus about getting more clients
 * downtown", due Friday, linked to Marcus. Rule-based (no AI), so it only
 * catches sentences that start like a to-do.
 */
export function extractNoteTasks(
  content: string,
  ctx: { now: Date; tzOffset: number; people: KnownPerson[]; personId: string | null },
): NoteTask[] {
  const tasks: NoteTask[] = [];
  for (const sentence of splitCommands(content)) {
    const lead = sentence.match(LEAD);
    const rest = lead ? sentence.slice(lead[0].length).trim() : sentence;
    if (!lead && !ACTION_VERB.test(rest) && !NOTE_VERB.test(rest)) continue;
    if (rest.split(/\s+/).length < 2) continue;

    const { date, remaining } = extractDate(rest, ctx.now, ctx.tzOffset);
    const title = (remaining.trim() || rest).replace(/^./, (c) => c.toUpperCase());
    const person = findMentionedPerson(rest, ctx.people);
    tasks.push({ title, dueAt: date, personId: person?.id ?? ctx.personId });
    if (tasks.length >= MAX_TASKS_PER_NOTE) break;
  }
  return tasks;
}
