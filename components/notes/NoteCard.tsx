"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { deleteNote, restoreNote, setNotePinned, updateNoteSafe } from "@/lib/actions/notes";
import { NoteText } from "@/components/notes/NoteText";
import { useUndo } from "@/components/ui/UndoToast";
import type { Note } from "@/lib/types";
import { isNew } from "@/lib/urgency";
import { Dictate } from "@/components/voice/Dictate";
import { PROSE_INPUT } from "@/lib/input-props";
import { autoGrow } from "@/lib/auto-grow";

export function NoteCard({
  note,
  personName,
  editable = false,
}: {
  note: Note;
  personName?: string | null;
  editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const undo = useUndo();

  async function remove() {
    await deleteNote(note.id);
    setEditing(false);
    router.refresh();
    undo.show("Note deleted", async () => {
      await restoreNote(note.id);
      router.refresh();
    });
  }

  async function togglePin() {
    await setNotePinned(note.id, !note.pinned_at);
    router.refresh();
  }

  async function save() {
    if (!content.trim() || content === note.content) {
      setEditing(false);
      setContent(note.content);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateNoteSafe(note.id, content);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <Card id={note.id} className="min-w-0 scroll-mt-20 p-3">
      {editing ? (
        <div className="space-y-1.5">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Dictate value={content} onChange={setContent}>
            <textarea
              {...PROSE_INPUT}
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void save();
                } else if (e.key === "Escape") {
                  setEditing(false);
                  setContent(note.content);
                }
              }}
              ref={autoGrow}
              onInput={(e) => autoGrow(e.currentTarget)}
              className="input min-h-[60px] w-full resize-none text-sm"
              disabled={saving}
            />
          </Dictate>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs text-accent hover:underline disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setContent(note.content);
                setError(null);
              }}
              className="text-xs text-text-muted hover:text-text"
            >
              Cancel
            </button>
            <button onClick={remove} className="ml-auto text-xs text-danger hover:underline">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div
          className={editable ? "cursor-text" : undefined}
          onClick={(e) => {
            // Tap anywhere on the note to edit it, except links, buttons, or when selecting text to copy.
            if (!editable || (e.target as HTMLElement).closest("a,button")) return;
            if (window.getSelection()?.toString()) return;
            setEditing(true);
          }}
        >
          <NoteText content={note.content} />
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {personName && note.person_id && (
            <Link href={`/people/${note.person_id}`} className="text-xs text-accent hover:underline">
              {personName}
            </Link>
          )}
          {note.pinned_at && <Badge tone="attention">pinned</Badge>}
          {isNew(note.created_at) && <Badge tone="new">new</Badge>}
          {note.category && <Badge>{note.category}</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="tabular-nums text-[11px] text-text-faint">
            {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          {editable && (
            <>
              <button
                type="button"
                onClick={togglePin}
                aria-pressed={Boolean(note.pinned_at)}
                aria-label={note.pinned_at ? "Unpin note" : "Pin note to the top"}
                title={note.pinned_at ? "Unpin" : "Pin to the top"}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs hover:bg-bg-hover ${note.pinned_at ? "text-accent" : "text-text-faint hover:text-accent"}`}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill={note.pinned_at ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 17v5M9 10.76V4h6v6.76l2.45 2.45A1 1 0 0 1 16.74 15H7.26a1 1 0 0 1-.71-1.71Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit note"
                title="Edit"
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs text-text-faint hover:bg-bg-hover hover:text-accent"
              >
                ✎
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
