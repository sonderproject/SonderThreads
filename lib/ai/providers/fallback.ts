import { extractDate } from "@/lib/ai/date";
import {
  CommandProvider,
  KnownClient,
  ParsedCommand,
  ParserContext,
  emptyParsedCommand,
} from "./types";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitNames(text: string): string[] {
  return text
    .split(/,|&|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchClientByName(name: string, clients: KnownClient[]): KnownClient | undefined {
  const norm = name.trim().toLowerCase();
  if (!norm) return undefined;
  return (
    clients.find((c) => c.displayName.toLowerCase() === norm) ||
    clients.find((c) => c.firstName.toLowerCase() === norm) ||
    clients.find((c) => c.displayName.toLowerCase().startsWith(norm)) ||
    clients.find((c) => norm.includes(c.firstName.toLowerCase()) && c.firstName.length > 2)
  );
}

function findMentionedClient(text: string, clients: KnownClient[]): KnownClient | undefined {
  const lower = text.toLowerCase();
  let best: KnownClient | undefined;
  let bestLen = 0;

  for (const c of clients) {
    const dn = c.displayName.toLowerCase();
    if (dn.length > bestLen && new RegExp(`\\b${escapeRegex(dn)}\\b`).test(lower)) {
      best = c;
      bestLen = dn.length;
    }
  }
  if (best) return best;

  for (const c of clients) {
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

    // --- create_list: "Create a list called Cohort 8" / "Make Cohort 8" ---
    const explicitListMatch = text.match(
      /^(create|make|start|add)\s+(a\s+|an\s+|new\s+)*list\s*(called|named)?\s*[:\-]?\s*(.+)$/i,
    );
    if (explicitListMatch) {
      const listName = explicitListMatch[4].trim();
      result.intent = "create_list";
      result.listName = listName;
      result.isCohort = /cohort/i.test(listName);
      result.confidence = 0.9;
      return result;
    }

    const cohortCreateMatch = text.match(/^(create|make|start|new)\s+(cohort\s+\S+)\b(.*)$/i);
    if (cohortCreateMatch) {
      result.intent = "create_list";
      result.listName = cohortCreateMatch[2].trim();
      result.isCohort = true;
      result.confidence = 0.9;
      return result;
    }

    // --- add_to_list: "Add Marcus, James and Wes to Cohort 7" ---
    const addToListMatch = text.match(/^add\s+(.+?)\s+to\s+(.+)$/i);
    if (addToListMatch) {
      const names = splitNames(addToListMatch[1]);
      const listName = addToListMatch[2].trim();
      const existingList = matchList(listName, context.lists);

      result.intent = "add_to_list";
      result.names = names;
      result.listName = listName;
      result.listId = existingList?.id ?? null;
      result.isCohort = /cohort/i.test(listName);
      result.confidence = 0.85;
      return result;
    }

    // --- create_client: "Add Marcus Johnson as a client" ---
    const addAsClientMatch = text.match(/^add\s+(.+?)\s+as\s+(a\s+|an\s+)?client\b/i);
    if (addAsClientMatch) {
      result.intent = "create_client";
      result.names = splitNames(addAsClientMatch[1]);
      result.confidence = 0.85;
      return result;
    }

    // --- create_client: plain "Add Marcus Johnson" with no other keyword ---
    const plainAddMatch = text.match(/^add\s+(.+)$/i);
    if (plainAddMatch) {
      result.intent = "create_client";
      result.names = splitNames(plainAddMatch[1]);
      result.confidence = 0.6;
      return result;
    }

    // --- create_task via explicit "create/add a task" ---
    const taskMatch = text.match(/^(create|add)\s+a\s+task\s*(to\s+)?(.+)$/i);
    if (taskMatch) {
      const rawContent = taskMatch[3].trim();
      const { date, remaining } = extractDate(rawContent, context.now);
      const mentioned = findMentionedClient(remaining, context.clients);
      result.intent = "create_task";
      result.content = remaining.trim() || rawContent;
      result.dueDate = date;
      result.clientId = mentioned?.id ?? null;
      if (mentioned) result.names = [mentioned.displayName];
      result.confidence = 0.85;
      return result;
    }

    // --- create_task via "Remind me to ..." ---
    const reminderMatch = text.match(/^remind me\s+(to\s+)?(.+)$/i);
    if (reminderMatch) {
      const rawContent = reminderMatch[2].trim();
      const { date, remaining } = extractDate(rawContent, context.now);
      const mentioned = findMentionedClient(remaining, context.clients);
      result.intent = "create_task";
      result.content = remaining.trim() || rawContent;
      result.dueDate = date;
      result.clientId = mentioned?.id ?? null;
      if (mentioned) result.names = [mentioned.displayName];
      result.confidence = 0.9;
      return result;
    }

    // --- update_client_status: "Set Marcus's current status to X" ---
    const statusMatch = text.match(
      /^(update|set)\s+(.+?)('s)?\s+(current status|next action|next step|status)\s+(to|is)\s+(.+)$/i,
    );
    if (statusMatch) {
      const clientName = statusMatch[2].trim();
      const field = /next/i.test(statusMatch[4]) ? "next_action" : "current_status";
      const mentioned = matchClientByName(clientName, context.clients);
      result.intent = "update_client_status";
      result.names = [clientName];
      result.clientId = mentioned?.id ?? null;
      result.statusField = field;
      result.content = statusMatch[6].trim();
      result.confidence = mentioned ? 0.9 : 0.5;
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

    // --- fall through: note (client-linked if a known client is mentioned) ---
    const contentForNote = noteContent ?? text;
    const mentioned = findMentionedClient(contentForNote, context.clients);

    if (mentioned) {
      result.intent = "add_client_note";
      result.clientId = mentioned.id;
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
