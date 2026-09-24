"use server";

import { query } from "@/lib/db/client";
import { OWNER_ID } from "@/lib/db/constants";
import { parseCommand } from "@/lib/ai/command-parser";
import { findClientByName, findOrCreateClientByName, updateClient } from "./clients";
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

export async function executeCommand(input: string): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { kind: "error", message: "Type something first." };
  }

  const [clients, lists] = await Promise.all([
    query<{ id: string; display_name: string; first_name: string; last_name: string | null }>(
      `select id, display_name, first_name, last_name from clients where user_id = $1 and deleted_at is null`,
      [OWNER_ID],
    ),
    query<{ id: string; name: string }>(
      `select id, name from lists where user_id = $1 and deleted_at is null`,
      [OWNER_ID],
    ),
  ]);

  const parsed = await parseCommand(trimmed, {
    now: new Date(),
    clients: clients.map((c) => ({
      id: c.id,
      displayName: c.display_name,
      firstName: c.first_name,
      lastName: c.last_name,
    })),
    lists: lists.map((l) => ({ id: l.id, name: l.name })),
  });

  try {
    switch (parsed.intent) {
      case "create_client": {
        const names = parsed.names.length > 0 ? parsed.names : [trimmed];
        const created: string[] = [];
        for (const name of names) {
          const { client, created: wasCreated } = await findOrCreateClientByName(name);
          if (wasCreated) created.push(client.display_name);
        }
        if (created.length === 0) {
          return { kind: "confirmation", message: "Already have that client on file." };
        }
        return { kind: "confirmation", message: `✓ Added ${created.join(", ")}` };
      }

      case "add_client_note": {
        let clientId = parsed.clientId;
        if (!clientId && parsed.names[0]) {
          const { client } = await findOrCreateClientByName(parsed.names[0]);
          clientId = client.id;
        }
        if (!clientId) {
          await createNote({ content: parsed.content ?? trimmed, category: parsed.category });
          return { kind: "confirmation", message: "✓ Note saved", href: "/notes" };
        }
        await createNote({ content: parsed.content ?? trimmed, clientId, category: parsed.category });
        const client = await findClientByName(parsed.names[0] ?? "");
        return {
          kind: "confirmation",
          message: `✓ Added note to ${client?.display_name ?? "client"}`,
          href: `/clients/${clientId}`,
        };
      }

      case "add_note": {
        await createNote({ content: parsed.content ?? trimmed, category: parsed.category });
        return { kind: "confirmation", message: "✓ Note saved" };
      }

      case "create_task": {
        let clientId = parsed.clientId;
        if (!clientId && parsed.names[0]) {
          const match = await findClientByName(parsed.names[0]);
          clientId = match?.id ?? null;
        }
        const task = await createTask({
          title: parsed.content ?? trimmed,
          clientId,
          dueAt: parsed.dueDate,
        });
        const client = clientId ? await findClientByName(parsed.names[0] ?? "") : null;
        const parts = [parsed.dueDate ? "Reminder" : "Task", "created"];
        if (client) parts.push(`for ${client.display_name}`);
        if (parsed.dueDate) parts.push(`(${formatDateShort(parsed.dueDate)})`);
        return { kind: "confirmation", message: `✓ ${parts.join(" ")}`, href: `/tasks#${task.id}` };
      }

      case "create_list": {
        const name = parsed.listName ?? trimmed;
        try {
          const list = await createList({ name, isCohort: parsed.isCohort });
          return {
            kind: "confirmation",
            message: `✓ ${parsed.isCohort ? "Cohort" : "List"} "${list.name}" created`,
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
        const { list } = await findOrCreateListByName(parsed.listName, parsed.isCohort);
        await addNamesToList(list.id, list.is_cohort, parsed.names);
        return {
          kind: "confirmation",
          message: `✓ Added ${parsed.names.join(", ")} to ${list.name}`,
          href: `/lists/${list.id}`,
        };
      }

      case "update_client_status": {
        if (!parsed.clientId && parsed.names[0]) {
          const match = await findClientByName(parsed.names[0]);
          parsed.clientId = match?.id ?? null;
        }
        if (!parsed.clientId || !parsed.statusField || !parsed.content) {
          return { kind: "error", message: "Couldn't find that client to update." };
        }
        await updateClient(parsed.clientId, { [parsed.statusField]: parsed.content });
        return {
          kind: "confirmation",
          message: `✓ Updated ${parsed.statusField === "next_action" ? "next action" : "current status"}`,
          href: `/clients/${parsed.clientId}`,
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
