import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Note } from "@/lib/types";

export function NoteCard({
  note,
  clientName,
}: {
  note: Note;
  clientName?: string | null;
}) {
  return (
    <Card className="p-3">
      <p className="text-sm text-text">{note.content}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {clientName && note.client_id && (
            <Link href={`/clients/${note.client_id}`} className="text-xs text-accent hover:underline">
              {clientName}
            </Link>
          )}
          {note.category && <Badge>{note.category}</Badge>}
        </div>
        <span className="font-mono text-[11px] text-text-faint">
          {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </div>
    </Card>
  );
}
