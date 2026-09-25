import { NotesBrowser } from "@/components/notes/NotesBrowser";
import { listAllNotes } from "@/lib/actions/notes";
import { listPeople } from "@/lib/actions/people";

export default async function NotesPage() {
  const [notes, people] = await Promise.all([listAllNotes(), listPeople()]);

  return (
    <div className="space-y-4">
      <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Notes</h1>
      <NotesBrowser notes={notes} people={people} />
    </div>
  );
}
