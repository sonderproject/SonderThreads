import {
  CommandIntent,
  ParsedCommand,
  ParserContext,
  SummaryInput,
  SummaryResult,
  emptyParsedCommand,
} from "./types";

const VALID_INTENTS: CommandIntent[] = [
  "create_person",
  "add_person_note",
  "add_note",
  "create_task",
  "create_list",
  "add_to_list",
  "update_person_status",
  "search",
  "unknown",
];

export function buildParsePrompt(input: string, context: ParserContext) {
  const personNames = context.people.map((c) => c.displayName).join(", ") || "(none yet)";
  const listNames = context.lists.map((l) => l.name).join(", ") || "(none yet)";

  const system = `You are the command parser for a minimal personal person-tracking tool.
Classify the user's one-line input into exactly one intent and extract structured fields.
Valid intents: ${VALID_INTENTS.join(", ")}.
Return ONLY a JSON object with these keys:
intent, names (array of strings), personId (string|null), content (string|null),
listName (string|null), listId (string|null), isGroup (boolean), category (string|null),
dueDate (ISO 8601 string|null), recurrence ("daily"|"weekly"|"monthly"|null), statusField ("current_status"|"next_action"|null), confidence (0-1 number).
Resolve personId/listId ONLY if a name clearly matches one of the known people/lists given below; otherwise leave null.
Today's date is ${context.now.toISOString()}.
Known people: ${personNames}
Known lists: ${listNames}`;

  const user = `Input: ${input}`;

  return { system, user };
}

export function coerceParsedCommand(raw: unknown, rawInput: string): ParsedCommand {
  const base = emptyParsedCommand(rawInput);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;

  const intent = VALID_INTENTS.includes(obj.intent as CommandIntent)
    ? (obj.intent as CommandIntent)
    : "unknown";

  return {
    ...base,
    intent,
    names: Array.isArray(obj.names) ? obj.names.filter((n) => typeof n === "string") : [],
    personId: typeof obj.personId === "string" ? obj.personId : null,
    content: typeof obj.content === "string" ? obj.content : null,
    listName: typeof obj.listName === "string" ? obj.listName : null,
    listId: typeof obj.listId === "string" ? obj.listId : null,
    isGroup: Boolean(obj.isGroup),
    category: typeof obj.category === "string" ? obj.category : null,
    dueDate: typeof obj.dueDate === "string" ? obj.dueDate : null,
    recurrence:
      obj.recurrence === "daily" || obj.recurrence === "weekly" || obj.recurrence === "monthly"
        ? obj.recurrence
        : null,
    statusField:
      obj.statusField === "current_status" || obj.statusField === "next_action"
        ? obj.statusField
        : null,
    confidence: typeof obj.confidence === "number" ? obj.confidence : 0.5,
  };
}

export function buildSummaryPrompt(input: SummaryInput) {
  const notesText =
    input.recentNotes.map((n) => `- (${n.createdAt}) ${n.content}`).join("\n") || "(no notes yet)";
  const tasksText =
    input.openTasks.map((t) => `- ${t.title}${t.dueAt ? ` (due ${t.dueAt})` : ""}`).join("\n") ||
    "(no open tasks)";

  const system = `You maintain a short running summary for a person in a personal tracking tool.
Write 2-5 short sentences covering: what's happening with them, what they recently accomplished,
what they currently need, and what to do next. Keep it plain and factual, no filler.
Also propose a short "currentStatus" (<=8 words) and "nextAction" (<=8 words) line.
Return ONLY a JSON object: { "summary": string, "currentStatus": string|null, "nextAction": string|null }.`;

  const user = `Person: ${input.person.displayName}
Existing current status: ${input.person.currentStatus ?? "(none)"}
Existing next action: ${input.person.nextAction ?? "(none)"}

Recent notes:
${notesText}

Open tasks:
${tasksText}`;

  return { system, user };
}

export function coerceSummaryResult(raw: unknown, generatedBy: string): SummaryResult {
  const fallback: SummaryResult = {
    summary: "",
    currentStatus: null,
    nextAction: null,
    generatedBy,
  };
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;

  return {
    summary: typeof obj.summary === "string" ? obj.summary : "",
    currentStatus: typeof obj.currentStatus === "string" ? obj.currentStatus : null,
    nextAction: typeof obj.nextAction === "string" ? obj.nextAction : null,
    generatedBy,
  };
}
