import { NotesBrowser } from "@/components/notes/NotesBrowser";
import { listAllNotes } from "@/lib/actions/notes";
import { listClients } from "@/lib/actions/clients";

export default async function NotesPage() {
  const [notes, clients] = await Promise.all([listAllNotes(), listClients()]);

  return (
    <div className="space-y-4">
      <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Notes</h1>
      <NotesBrowser notes={notes} clients={clients} />
    </div>
  );
}
