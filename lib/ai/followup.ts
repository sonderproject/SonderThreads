/**
 * Spoken/typed commands that name *what* to create but not its content —
 * "create new note", "new task", "make a list". Instead of saving the words
 * themselves as a note, the command bar asks a follow-up question and
 * builds a complete command from the answer.
 */
export type FollowUpKind = "note" | "task" | "list" | "group" | "person" | "search";

export type FollowUp =
  | { kind: FollowUpKind }
  | { kind: "list-items"; listName: string };

const BARE =
  /^(?:(?:please\s+)?(?:create|make|add|start|new|open|write|take|set)\s+)?(?:(?:a|an|another|me\s+a)\s+)?(?:new\s+)?(note|task|to-?do|reminder|(?:task|to-?do|shopping|grocery)\s+list|list|group|person|contact|search)$/i;

export function detectBareCommand(input: string): FollowUp | null {
  const m = input.trim().replace(/[.!?]+$/, "").match(BARE);
  if (!m) return null;
  const noun = m[1].toLowerCase();
  if (noun === "note") return { kind: "note" };
  if (noun === "task" || noun.startsWith("to") || noun === "reminder") return { kind: "task" };
  if (noun === "group") return { kind: "group" };
  if (noun === "person" || noun === "contact") return { kind: "person" };
  if (noun === "search") return { kind: "search" };
  return { kind: "list" };
}

export function followUpPrompt(f: FollowUp): string {
  switch (f.kind) {
    case "note":
      return "What's the note?";
    case "task":
      return "What's the task? (add a day or time if you like)";
    case "list":
      return "What's the list called?";
    case "group":
      return "What's the group called?";
    case "person":
      return "Who are you adding?";
    case "search":
      return "Search for?";
    case "list-items":
      return `Add items to ${f.listName} — or say "done"`;
  }
}

const DONE = /^(done|stop|finish(ed)?|that'?s (it|all)|no|nothing|cancel|exit)$/i;

/** Turns the answer to a follow-up into a full command, or null when the user is finished. */
export function applyFollowUp(f: FollowUp, answer: string): string | null {
  const a = answer.trim().replace(/[.!?]+$/, "");
  if (!a || DONE.test(a)) return null;
  switch (f.kind) {
    case "note":
      return `note: ${a}`;
    case "task":
      return `create a task to ${a}`;
    case "list":
      return `create a list called ${a}`;
    case "group":
      return `create a group called ${a}`;
    case "person":
      return `add ${a} as a person`;
    case "search":
      return `search ${a}`;
    case "list-items":
      return `add ${a} to ${f.listName}`;
  }
}

export const isDoneWord = (s: string) => DONE.test(s.trim().replace(/[.!?]+$/, ""));
