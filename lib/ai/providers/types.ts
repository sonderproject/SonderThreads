export type CommandIntent =
  | "create_client"
  | "add_client_note"
  | "add_note"
  | "create_task"
  | "create_list"
  | "add_to_list"
  | "update_client_status"
  | "search"
  | "unknown";

export interface KnownClient {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string | null;
}

export interface KnownList {
  id: string;
  name: string;
}

export interface ParserContext {
  now: Date;
  clients: KnownClient[];
  lists: KnownList[];
}

export interface ParsedCommand {
  intent: CommandIntent;
  raw: string;
  /** Names mentioned in the input, in the order they should be processed. */
  names: string[];
  /** Resolved single client id, when the command clearly targets one known client. */
  clientId: string | null;
  /** Free text content for a note or task title. */
  content: string | null;
  /** Name of a list/cohort referenced or being created. */
  listName: string | null;
  /** Resolved id of an existing list, if matched. */
  listId: string | null;
  /** True when the list being created/targeted should be treated as a cohort. */
  isCohort: boolean;
  /** Loose category tag for notes, e.g. "certification", "employment". */
  category: string | null;
  /** ISO date string for tasks/reminders. */
  dueDate: string | null;
  /** Which client field an update_client_status command targets. */
  statusField: "current_status" | "next_action" | null;
  /** 0-1 confidence score from the provider. */
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface CommandProvider {
  name: string;
  parse(input: string, context: ParserContext): Promise<ParsedCommand>;
}

export interface SummaryInput {
  client: {
    displayName: string;
    currentStatus: string | null;
    nextAction: string | null;
  };
  recentNotes: { content: string; createdAt: string }[];
  openTasks: { title: string; dueAt: string | null }[];
}

export interface SummaryResult {
  summary: string;
  currentStatus: string | null;
  nextAction: string | null;
  generatedBy: string;
}

export interface SummaryProvider {
  name: string;
  summarize(input: SummaryInput): Promise<SummaryResult>;
}

export function emptyParsedCommand(raw: string): ParsedCommand {
  return {
    intent: "unknown",
    raw,
    names: [],
    clientId: null,
    content: null,
    listName: null,
    listId: null,
    isCohort: false,
    category: null,
    dueDate: null,
    statusField: null,
    confidence: 0,
  };
}
