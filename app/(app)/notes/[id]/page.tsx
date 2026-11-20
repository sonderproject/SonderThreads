import { notFound } from "next/navigation";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { getNote } from "@/lib/actions/notes";
import { listPeople } from "@/lib/actions/people";
import { isUuid } from "@/lib/ids";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [note, people] = await Promise.all([getNote(id), listPeople()]);
  if (!note) notFound();
  return <NoteEditor key={note.id} note={note} people={people.map((p) => ({ id: p.id, label: p.display_name }))} />;
}
