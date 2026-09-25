import { SummaryInput, SummaryProvider, SummaryResult } from "./types";

function truncate(text: string, max = 90): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Deterministic, dependency-free summary generator. Keeps the "smart person
 * summary" feature working with zero AI API keys configured: it builds a
 * short factual paragraph from the most recent notes and open tasks rather
 * than calling out to a model.
 */
export const fallbackSummaryProvider: SummaryProvider = {
  name: "fallback",

  async summarize(input: SummaryInput): Promise<SummaryResult> {
    const { person, recentNotes, openTasks } = input;
    const latestNote = recentNotes[0];
    const nextTask = openTasks[0];

    const sentences: string[] = [];

    if (latestNote) {
      sentences.push(`Most recently: ${truncate(latestNote.content)}.`);
    }

    if (recentNotes.length > 1) {
      const priorHighlights = recentNotes
        .slice(1, 3)
        .map((n) => truncate(n.content, 60))
        .join("; ");
      if (priorHighlights) sentences.push(`Also recently: ${priorHighlights}.`);
    }

    if (nextTask) {
      sentences.push(
        `Next up: ${truncate(nextTask.title, 70)}${nextTask.dueAt ? ` (due ${new Date(nextTask.dueAt).toLocaleDateString()})` : ""}.`,
      );
    } else if (person.nextAction) {
      sentences.push(`Next: ${truncate(person.nextAction, 70)}.`);
    }

    if (sentences.length === 0) {
      sentences.push(`No notes or tasks logged for ${person.displayName} yet.`);
    }

    const currentStatus = latestNote ? truncate(latestNote.content, 60) : person.currentStatus;
    const nextAction = nextTask ? truncate(nextTask.title, 60) : person.nextAction;

    return {
      summary: sentences.slice(0, 5).join(" "),
      currentStatus,
      nextAction,
      generatedBy: "fallback",
    };
  },
};
