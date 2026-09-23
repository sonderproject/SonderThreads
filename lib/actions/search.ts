"use server";

import { searchClients } from "./clients";
import { searchNotes } from "./notes";
import { searchLists } from "./lists";
import { searchTasks } from "./tasks";
import type { Client, List, Note, Task } from "@/lib/types";

export interface SearchResults {
  clients: Client[];
  notes: Note[];
  lists: List[];
  tasks: Task[];
}

export async function searchAll(query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { clients: [], notes: [], lists: [], tasks: [] };
  }

  const [clients, notes, lists, tasks] = await Promise.all([
    searchClients(trimmed),
    searchNotes(trimmed),
    searchLists(trimmed),
    searchTasks(trimmed),
  ]);

  return { clients, notes, lists, tasks };
}
