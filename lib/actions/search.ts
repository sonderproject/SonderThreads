"use server";

import { searchPeople } from "./people";
import { searchNotes } from "./notes";
import { searchLists } from "./lists";
import { searchTasks } from "./tasks";
import type { Person, List, Note, Task } from "@/lib/types";

export interface SearchResults {
  people: Person[];
  notes: Note[];
  lists: List[];
  tasks: Task[];
}

export async function searchAll(query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { people: [], notes: [], lists: [], tasks: [] };
  }

  const [people, notes, lists, tasks] = await Promise.all([
    searchPeople(trimmed),
    searchNotes(trimmed),
    searchLists(trimmed),
    searchTasks(trimmed),
  ]);

  return { people, notes, lists, tasks };
}
