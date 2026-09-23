import {
  CommandIntent,
  ParsedCommand,
  ParserContext,
  SummaryInput,
  SummaryResult,
  emptyParsedCommand,
} from "./types";

const VALID_INTENTS: CommandIntent[] = [
  "create_client",
  "add_client_note",
  "add_note",
  "create_task",
  "create_list",
  "add_to_list",
  "update_client_status",
  "search",
  "unknown",
];

export function buildParsePrompt(input: string, context: ParserContext) {
  const clientNames = context.clients.map((c) => c.displayName).join(", ") || "(none yet)";
  const listNames = context.lists.map((l) => l.name).join(", ") || "(none yet)";

  const system = `You are the command parser for a minimal personal client-tracking tool.
Classify the user's one-line input into exactly one intent and extract structured fields.
Valid intents: ${VALID_INTENTS.join(", ")}.
Return ONLY a JSON object with these keys:
intent, names (array of strings), clientId (string|null), content (string|null),
listName (string|null), listId (string|null), isCohort (boolean), category (string|null),
dueDate (ISO 8601 string|null), statusField ("current_status"|"next_action"|null), confidence (0-1 number).
Resolve clientId/listId ONLY if a name clearly matches one of the known clients/lists given below; otherwise leave null.
Today's date is ${context.now.toISOString()}.
Known clients: ${clientNames}
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
    clientId: typeof obj.clientId === "string" ? obj.clientId : null,
    content: typeof obj.content === "string" ? obj.content : null,
    listName: typeof obj.listName === "string" ? obj.listName : null,
    listId: typeof obj.listId === "string" ? obj.listId : null,
    isCohort: Boolean(obj.isCohort),
    category: typeof obj.category === "string" ? obj.category : null,
    dueDate: typeof obj.dueDate === "string" ? obj.dueDate : null,
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

  const system = `You maintain a short running summary for a client in a personal tracking tool.
Write 2-5 short sentences covering: what's happening with them, what they recently accomplished,
what they currently need, and what to do next. Keep it plain and factual, no filler.
Also propose a short "currentStatus" (<=8 words) and "nextAction" (<=8 words) line.
Return ONLY a JSON object: { "summary": string, "currentStatus": string|null, "nextAction": string|null }.`;

  const user = `Client: ${input.client.displayName}
Existing current status: ${input.client.currentStatus ?? "(none)"}
Existing next action: ${input.client.nextAction ?? "(none)"}

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
