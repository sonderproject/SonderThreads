import { extractDate, extractRecurrence } from "@/lib/ai/date";
import {
  CommandProvider,
  KnownPerson,
  ParsedCommand,
  ParserContext,
  emptyParsedCommand,
} from "./types";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startOfToday(now: Date, tzOffset: number): string {
  return extractDate("today", now, tzOffset).date!;
}

/** Sentences that start like a to-do ("call…", "buy…", "email…") become tasks. */
const ACTION_VERB =
  /^(call|phone|text|email|e-mail|message|buy|get|grab|pick up|drop off|pay|send|schedule|book|check|follow up|meet|visit|finish|submit|renew|clean|fix|bring|order|review|prepare|prep|write|apply|sign|return|cancel|confirm|ask|tell|water|take|mail|print|reach out|reply|respond|register|study|practice|clean up|wash|cook|make an appointment)\b/i;

function splitNames(text: string): string[] {
  return text
    .split(/,|&|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchPersonByName(name: string, people: KnownPerson[]): KnownPerson | undefined {
  const norm = name.trim().toLowerCase();
  if (!norm) return undefined;
  return (
    people.find((c) => c.displayName.toLowerCase() === norm) ||
    people.find((c) => c.firstName.toLowerCase() === norm) ||
    people.find((c) => c.displayName.toLowerCase().startsWith(norm)) ||
    people.find((c) => norm.includes(c.firstName.toLowerCase()) && c.firstName.length > 2)
  );
}

function findMentionedPerson(text: string, people: KnownPerson[]): KnownPerson | undefined {
  const lower = text.toLowerCase();
  let best: KnownPerson | undefined;
  let bestLen = 0;

  for (const c of people) {
    const dn = c.displayName.toLowerCase();
    if (dn.length > bestLen && new RegExp(`\\b${escapeRegex(dn)}\\b`).test(lower)) {
      best = c;
      bestLen = dn.length;
    }
  }
  if (best) return best;

  for (const c of people) {
    const fn = c.firstName.toLowerCase();
    if (fn.length > 2 && fn.length > bestLen && new RegExp(`\\b${escapeRegex(fn)}\\b`).test(lower)) {
      best = c;
      bestLen = fn.length;
    }
  }
  return best;
}

function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  if (/(guard card|certification|certified|licensed?)\b/.test(lower)) return "certification";
  if (/(job|hired|amazon|employ|interview|onboarding|position|work)/.test(lower)) return "employment";
  if (/(transport|ride|bus\b|carpool)/.test(lower)) return "transportation";
  if (/(housing|apartment|shelter)/.test(lower)) return "housing";
  if (/(follow[\s-]?up|check[\s-]?in)/.test(lower)) return "follow_up";
  return null;
}

function matchList(name: string, lists: ParserContext["lists"]) {
  const norm = name.trim().toLowerCase();
  return lists.find((l) => l.name.toLowerCase() === norm);
}

export const fallbackProvider: CommandProvider = {
  name: "fallback",

  async parse(input: string, context: ParserContext): Promise<ParsedCommand> {
    const text = input.trim();
    const result = emptyParsedCommand(text);
    if (!text) return result;

    // --- create_list: "Create a list called Groceries" / "Make a group called Spring 2026" / "New group 8" ---
    const explicitListMatch = text.match(
      /^(create|make|start|add|new)\s+(?:a\s+|an\s+|new\s+)*(?:(?:task|to-?do|shopping|grocery)\s+)?(list|group)\b\s*(called|named)?\s*[:\-]?\s*(.+)$/i,
    );
    if (explicitListMatch) {
      const kind = explicitListMatch[2].toLowerCase();
      let listName = explicitListMatch[4].trim();
      // "New group 8" — a bare number isn't much of a name, so keep the noun.
      if (!explicitListMatch[3] && /^\d+$/.test(listName)) {
        listName = `${kind[0].toUpperCase()}${kind.slice(1)} ${listName}`;
      }
      result.intent = "create_list";
      result.listName = listName;
      result.isGroup = kind === "group";
      result.confidence = 0.9;
      return result;
    }

    // --- add_to_list: "Add Marcus, James and Wes to Group 7" ---
    const addToListMatch = text.match(/^add\s+(.+?)\s+to\s+(.+)$/i);
    if (addToListMatch) {
      const names = splitNames(addToListMatch[1]);
      const listName = addToListMatch[2].trim().replace(/^the\s+/i, "");
      const existingList = matchList(listName, context.lists);

      result.intent = "add_to_list";
      result.names = names;
      result.listName = listName;
      result.listId = existingList?.id ?? null;
      // An existing list keeps its own type; a new one is a group only if the
      // input calls it one ("Add Marcus to the spring group").
      result.isGroup = existingList ? existingList.isGroup : /\bgroup\b/i.test(listName);
      result.confidence = 0.85;
      return result;
    }

    // --- create_person: "Add Marcus Johnson as a new student" (any role noun) ---
    const addAsRoleMatch = text.match(/^add\s+(.+?)\s+as\s+(?:a|an)\s+(?:new\s+)?[a-z-]+\s*$/i);
    if (addAsRoleMatch) {
      result.intent = "create_person";
      result.names = splitNames(addAsRoleMatch[1]);
      result.confidence = 0.85;
      return result;
    }

    // --- create_person: plain "Add Marcus Johnson" with no other keyword ---
    const plainAddMatch = text.match(/^add\s+(.+)$/i);
    if (plainAddMatch) {
      result.intent = "create_person";
      result.names = splitNames(plainAddMatch[1]);
      result.confidence = 0.6;
      return result;
    }

    // --- create_task via explicit "create/add a task" ---
    const taskMatch = text.match(/^(create|add)\s+a\s+task\s*(to\s+)?(.+)$/i);
    if (taskMatch) {
      const recurring = extractRecurrence(taskMatch[3].trim());
      const rawContent = recurring.remaining;
      const { date, remaining } = extractDate(rawContent, context.now, context.tzOffset);
      const mentioned = findMentionedPerson(remaining, context.people);
      result.intent = "create_task";
      result.content = remaining.trim() || rawContent;
      result.dueDate = date ?? (recurring.recurrence ? startOfToday(context.now, context.tzOffset) : null);
      result.recurrence = recurring.recurrence;
      result.personId = mentioned?.id ?? null;
      if (mentioned) result.names = [mentioned.displayName];
      result.confidence = 0.85;
      return result;
    }

    // --- create_task via "Remind me to ..." ---
    const reminderMatch = text.match(/^remind me\s+(to\s+)?(.+)$/i);
    if (reminderMatch) {
      const recurring = extractRecurrence(reminderMatch[2].trim());
      const rawContent = recurring.remaining;
      const { date, remaining } = extractDate(rawContent, context.now, context.tzOffset);
      const mentioned = findMentionedPerson(remaining, context.people);
      result.intent = "create_task";
      result.content = remaining.trim() || rawContent;
      result.dueDate = date ?? (recurring.recurrence ? startOfToday(context.now, context.tzOffset) : null);
      result.recurrence = recurring.recurrence;
      result.personId = mentioned?.id ?? null;
      if (mentioned) result.names = [mentioned.displayName];
      result.confidence = 0.9;
      return result;
    }

    // --- update_person_status: "Set Marcus's current status to X" ---
    const statusMatch = text.match(
      /^(update|set)\s+(.+?)('s)?\s+(current status|next action|next step|status)\s+(to|is)\s+(.+)$/i,
    );
    if (statusMatch) {
      const personName = statusMatch[2].trim();
      const field = /next/i.test(statusMatch[4]) ? "next_action" : "current_status";
      const mentioned = matchPersonByName(personName, context.people);
      result.intent = "update_person_status";
      result.names = [personName];
      result.personId = mentioned?.id ?? null;
      result.statusField = field;
      result.content = statusMatch[6].trim();
      result.confidence = mentioned ? 0.9 : 0.5;
      return result;
    }

    // --- create_task from an action phrase: "Call Marcus Friday at 3", "Buy printer ink" ---
    if (ACTION_VERB.test(text)) {
      const recurring = extractRecurrence(text);
      const { date, remaining } = extractDate(recurring.remaining, context.now, context.tzOffset);
      const mentioned = findMentionedPerson(remaining, context.people);
      result.intent = "create_task";
      result.content = remaining.trim() || text;
      result.dueDate = date ?? (recurring.recurrence ? startOfToday(context.now, context.tzOffset) : null);
      result.recurrence = recurring.recurrence;
      result.personId = mentioned?.id ?? null;
      if (mentioned) result.names = [mentioned.displayName];
      result.confidence = 0.7;
      return result;
    }

    // --- explicit note: "Note: ..." ---
    const explicitNoteMatch = text.match(/^note:?\s+(.+)$/i);
    const noteContent = explicitNoteMatch ? explicitNoteMatch[1].trim() : null;

    // --- search: "Show me everyone I need to follow up with" ---
    const searchMatch = text.match(/^(show me|find|search(\s+for)?)\s+(.+)$/i);
    if (searchMatch && !noteContent) {
      result.intent = "search";
      result.content = searchMatch[3].trim();
      result.confidence = 0.8;
      return result;
    }

    // --- fall through: note (person-linked if a known person is mentioned) ---
    const contentForNote = noteContent ?? text;
    const mentioned = findMentionedPerson(contentForNote, context.people);

    if (mentioned) {
      result.intent = "add_person_note";
      result.personId = mentioned.id;
      result.names = [mentioned.displayName];
      result.content = contentForNote;
      result.category = detectCategory(contentForNote);
      result.confidence = noteContent ? 0.85 : 0.7;
      return result;
    }

    result.intent = "add_note";
    result.content = contentForNote;
    result.category = detectCategory(contentForNote);
    result.confidence = noteContent ? 0.75 : 0.4;
    return result;
  },
};
