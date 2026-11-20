import { NoteEditor } from "@/components/notes/NoteEditor";
import { listPeople } from "@/lib/actions/people";
import { isUuid } from "@/lib/ids";

/** A new note on its own page. Nothing is saved until something is written. `?person=<id>` links it to someone. */
export default async function NewNotePage({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  const { person } = await searchParams;
  const people = await listPeople();
  const initialPersonId = person && isUuid(person) && people.some((p) => p.id === person) ? person : null;
  return <NoteEditor note={null} initialPersonId={initialPersonId} people={people.map((p) => ({ id: p.id, label: p.display_name }))} />;
}
