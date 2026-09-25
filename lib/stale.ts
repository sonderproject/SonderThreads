import type { Person } from "@/lib/types";

/** A person with no logged activity (notes, tasks, list adds, updates) for this many days is flagged stale. */
export const STALE_DAYS = 14;

export function isStale(person: Pick<Person, "last_activity_at">, now = Date.now()): boolean {
  return now - new Date(person.last_activity_at).getTime() >= STALE_DAYS * 24 * 60 * 60 * 1000;
}
