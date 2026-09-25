"use server";

import { query } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { parseCommand, type ParserContext } from "@/lib/ai/command-parser";
import { fallbackProvider } from "@/lib/ai/providers/fallback";
import { findPersonByName, findOrCreatePersonByName, updatePerson } from "./people";
import { createNote } from "./notes";
import { createTask } from "./tasks";
import { createList, findOrCreateListByName, addNamesToList } from "./lists";
import { searchAll, type SearchResults } from "./search";

export type CommandResult =
  | { kind: "confirmation"; message: string; href?: string }
  | { kind: "search_results"; query: string; results: SearchResults }
  | { kind: "error"; message: string };

function formatDateShort(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

async function loadParserContext(): Promise<ParserContext> {
  const [people, lists] = await Promise.all([
    query<{ id: string; display_name: string; first_name: string; last_name: string | null }>(
      `select id, display_name, first_name, last_name from people where user_id = $1 and deleted_at is null`,
      [OWNER_ID],
    ),
    query<{ id: string; name: string; is_group: boolean }>(
      `select id, name, is_group from lists where user_id = $1 and deleted_at is null`,
      [OWNER_ID],
    ),
  ]);

  return {
    now: new Date(),
    people: people.map((c) => ({
      id: c.id,
      displayName: c.display_name,
      firstName: c.first_name,
      lastName: c.last_name,
    })),
    lists: lists.map((l) => ({ id: l.id, name: l.name, isGroup: l.is_group })),
  };
}

export type CommandPreview = {
  /** What will happen, e.g. "task", "note on", "new group". */
  action: string;
  /** Short facts to show after the action: the title, person, list, repeat. */
  details: string[];
  /** ISO due date; formatted in the browser so it's in the user's time zone. */
  dueDate: string | null;
};

/**
 * A best-guess preview of what executeCommand() would do, shown live under
 * the command bar as you type. Always uses the built-in parser (instant, no
 * AI cost), so with an AI provider configured the real result can differ
 * slightly on ambiguous input.
 */
export async function previewCommand(input: string): Promise<CommandPreview | null> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return null;

  const context = await loadParserContext();
  const p = await fallbackProvider.parse(trimmed, context);
  const quote = (s: string | null) => (s ? `"${s.length > 40 ? `${s.slice(0, 39)}…` : s}"` : null);
  const listKnown = p.listName ? context.lists.some((l) => l.name.toLowerCase() === p.listName!.toLowerCase()) : false;
  const compact = (xs: (string | null | false | undefined)[]) => xs.filter(Boolean) as string[];

  switch (p.intent) {
    case "create_person":
      return { action: p.names.length > 1 ? "new people" : "new person", details: p.names, dueDate: null };
    case "add_person_note":
      return { action: "note on", details: compact([p.names[0], p.category && `#${p.category}`]), dueDate: null };
    case "create_task":
      return {
        action: p.dueDate ? "reminder" : "task",
        details: compact([quote(p.content), p.names[0], p.recurrence && `↻ ${p.recurrence}`]),
        dueDate: p.dueDate,
      };
    case "create_list":
      return { action: p.isGroup ? "new group" : "new list", details: compact([p.listName]), dueDate: null };
    case "add_to_list":
      return {
        action: `add to ${p.listName}`,
        details: compact([p.names.join(", "), !listKnown && (p.isGroup ? "new group" : "new list")]),
        dueDate: null,
      };
    case "update_person_status":
      return {
        action: `update ${p.statusField === "next_action" ? "next action" : "status"}`,
        details: compact([p.names[0], quote(p.content)]),
        dueDate: null,
      };
    case "search":
      return { action: "search", details: compact([quote(p.content)]), dueDate: null };
    default:
      return { action: "note", details: compact([p.category && `#${p.category}`]), dueDate: null };
  }
}

export async function executeCommand(input: string): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { kind: "error", message: "Type something first." };
  }

  const parsed = await parseCommand(trimmed, await loadParserContext());

  try {
    switch (parsed.intent) {
      case "create_person": {
        const names = parsed.names.length > 0 ? parsed.names : [trimmed];
        const created: string[] = [];
        for (const name of names) {
          const { person, created: wasCreated } = await findOrCreatePersonByName(name);
          if (wasCreated) created.push(person.display_name);
        }
        if (created.length === 0) {
          return { kind: "confirmation", message: "Already have that person on file." };
        }
        return { kind: "confirmation", message: `✓ Added ${created.join(", ")}` };
      }

      case "add_person_note": {
        let personId = parsed.personId;
        if (!personId && parsed.names[0]) {
          const { person } = await findOrCreatePersonByName(parsed.names[0]);
          personId = person.id;
        }
        if (!personId) {
          await createNote({ content: parsed.content ?? trimmed, category: parsed.category });
          return { kind: "confirmation", message: "✓ Note saved", href: "/notes" };
        }
        await createNote({ content: parsed.content ?? trimmed, personId, category: parsed.category });
        const person = await findPersonByName(parsed.names[0] ?? "");
        return {
          kind: "confirmation",
          message: `✓ Added note to ${person?.display_name ?? "person"}`,
          href: `/people/${personId}`,
        };
      }

      case "add_note": {
        await createNote({ content: parsed.content ?? trimmed, category: parsed.category });
        return { kind: "confirmation", message: "✓ Note saved" };
      }

      case "create_task": {
        let personId = parsed.personId;
        if (!personId && parsed.names[0]) {
          const match = await findPersonByName(parsed.names[0]);
          personId = match?.id ?? null;
        }
        const task = await createTask({
          title: parsed.content ?? trimmed,
          personId,
          dueAt: parsed.dueDate,
          recurrence: parsed.recurrence,
        });
        const person = personId ? await findPersonByName(parsed.names[0] ?? "") : null;
        const parts = [parsed.dueDate ? "Reminder" : "Task", "created"];
        if (person) parts.push(`for ${person.display_name}`);
        if (parsed.dueDate) parts.push(`(${formatDateShort(parsed.dueDate)})`);
        if (parsed.recurrence) parts.push(`↻ ${parsed.recurrence}`);
        return { kind: "confirmation", message: `✓ ${parts.join(" ")}`, href: `/tasks#${task.id}` };
      }

      case "create_list": {
        const name = parsed.listName ?? trimmed;
        try {
          const list = await createList({ name, isGroup: parsed.isGroup });
          return {
            kind: "confirmation",
            message: `✓ ${parsed.isGroup ? "Group" : "List"} "${list.name}" created`,
            href: `/lists/${list.id}`,
          };
        } catch {
          return { kind: "confirmation", message: `"${name}" already exists` };
        }
      }

      case "add_to_list": {
        if (!parsed.listName || parsed.names.length === 0) {
          return { kind: "error", message: "Couldn't tell who to add or which list." };
        }
        const { list } = await findOrCreateListByName(parsed.listName, parsed.isGroup);
        await addNamesToList(list.id, list.is_group, parsed.names);
        return {
          kind: "confirmation",
          message: `✓ Added ${parsed.names.join(", ")} to ${list.name}`,
          href: `/lists/${list.id}`,
        };
      }

      case "update_person_status": {
        if (!parsed.personId && parsed.names[0]) {
          const match = await findPersonByName(parsed.names[0]);
          parsed.personId = match?.id ?? null;
        }
        if (!parsed.personId || !parsed.statusField || !parsed.content) {
          return { kind: "error", message: "Couldn't find that person to update." };
        }
        await updatePerson(parsed.personId, { [parsed.statusField]: parsed.content });
        return {
          kind: "confirmation",
          message: `✓ Updated ${parsed.statusField === "next_action" ? "next action" : "current status"}`,
          href: `/people/${parsed.personId}`,
        };
      }

      case "search": {
        const results = await searchAll(parsed.content ?? trimmed);
        return { kind: "search_results", query: parsed.content ?? trimmed, results };
      }

      case "unknown":
      default: {
        await createNote({ content: trimmed });
        return { kind: "confirmation", message: "✓ Saved as a note" };
      }
    }
  } catch (err) {
    console.error("[command] execution failed", err);
    const message = err instanceof Error ? err.message : "Something went wrong running that command.";
    return { kind: "error", message };
  }
}
