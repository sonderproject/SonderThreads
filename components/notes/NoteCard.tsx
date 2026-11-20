"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { setNotePinned } from "@/lib/actions/notes";
import type { Note } from "@/lib/types";
import { isNew } from "@/lib/urgency";
import { NoteText } from "@/components/notes/NoteText";
import { PinIcon } from "@/components/notes/PinIcon";
import { ShareToTeam } from "@/components/messages/ShareToTeam";

/** A note in a grid. Tap it to open the note on its own page; `editable` shows the pin button. */
export function NoteCard({
  note,
  personName,
  editable = false,
}: {
  note: Note;
  personName?: string | null;
  editable?: boolean;
}) {
  const router = useRouter();
  const href = `/notes/${note.id}`;

  async function togglePin() {
    await setNotePinned(note.id, !note.pinned_at);
    router.refresh();
  }

  return (
    <Card
      id={note.id}
      className="min-w-0 cursor-pointer scroll-mt-20 p-3 transition-colors hover:border-accent"
      onClick={(e: React.MouseEvent) => {
        // Tap anywhere on the note to open it, except links, buttons, or when selecting text to copy.
        if ((e.target as HTMLElement).closest("a,button")) return;
        if (window.getSelection()?.toString()) return;
        router.push(href);
      }}
    >
      <NoteText content={note.content} />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {personName && note.person_id && (
            <Link href={`/people/${note.person_id}`} className="max-w-full truncate text-xs text-accent hover:underline">
              {personName}
            </Link>
          )}
          {note.pinned_at && <Badge tone="attention">pinned</Badge>}
          {isNew(note.created_at) && <Badge tone="new">new</Badge>}
          {note.category && <Badge>{note.category}</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Its dialog sits inside the card: keep taps there from opening the note. */}
          <span onClick={(e) => e.stopPropagation()} className="mr-1">
            <ShareToTeam kind="note" id={note.id} className="text-[11px] text-text-faint hover:text-accent hover:underline" />
          </span>
          <span className="tabular-nums text-[11px] text-text-faint">
            {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          {editable && (
            <button
              type="button"
              onClick={togglePin}
              aria-pressed={Boolean(note.pinned_at)}
              aria-label={note.pinned_at ? "Unpin note" : "Pin note to the top"}
              title={note.pinned_at ? "Unpin" : "Pin to the top"}
              className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-bg-hover ${note.pinned_at ? "text-accent" : "text-text-faint hover:text-accent"}`}
            >
              <PinIcon filled={Boolean(note.pinned_at)} />
            </button>
          )}
          <Link
            href={href}
            aria-label="Open note"
            title="Open"
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs text-text-faint hover:bg-bg-hover hover:text-accent"
          >
            ⤢
          </Link>
        </div>
      </div>
    </Card>
  );
}
