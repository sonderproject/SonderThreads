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

export type NoteTask = { title: string; dueAt: string | null; personId: string | null; notes?: string | null };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every known person a note names: by full name, or by first name when only
 * one person has it (so "Marcus" doesn't guess between two Marcuses).
 */
function mentionedPeople(text: string, people: KnownPerson[]): KnownPerson[] {
  const lower = text.toLowerCase();
  const has = (word: string) => new RegExp(`\\b${escapeRegex(word.toLowerCase())}\\b`).test(lower);
  const firstNameCount = new Map<string, number>();
  for (const p of people) {
    const f = p.firstName.toLowerCase();
    firstNameCount.set(f, (firstNameCount.get(f) ?? 0) + 1);
  }
  return people.filter(
    (p) =>
      has(p.displayName) ||
      (p.firstName.length > 2 && firstNameCount.get(p.firstName.toLowerCase()) === 1 && has(p.firstName)),
  );
}

/**
 * Pulls the to-dos out of a note, one per sentence that reads like one:
 * "Marcus got hired. Talk to Marcus about getting more clients downtown
 * Friday." → one task, "Talk to Marcus about getting more clients
 * downtown", due Friday, linked to Marcus. Rule-based (no AI), so it only
 * catches sentences that start like a to-do — plus one "Follow up with …"
 * task for each known person the note is about.
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

  // A note about someone always leaves a follow-up for them, even with no
  // to-do wording ("Marcus got hired at Amazon" → "Follow up with Marcus").
  // People who already got a task from a to-do sentence above are skipped.
  const covered = new Set(tasks.map((t) => t.personId).filter(Boolean));
  const about = mentionedPeople(content, ctx.people);
  const attached = ctx.personId ? ctx.people.find((p) => p.id === ctx.personId) : undefined;
  if (attached && !about.includes(attached)) about.unshift(attached);
  const { date } = extractDate(content, ctx.now, ctx.tzOffset);
  for (const p of about) {
    if (covered.has(p.id) || tasks.length >= MAX_TASKS_PER_NOTE) continue;
    tasks.push({ title: `Follow up with ${p.displayName}`, dueAt: date, personId: p.id, notes: content.slice(0, 2000) });
  }
  return tasks;
}
