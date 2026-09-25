"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { updateNoteSafe } from "@/lib/actions/notes";
import type { Note } from "@/lib/types";

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
    <Card className="p-3">
      {editing ? (
        <div className="space-y-1.5">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setContent(note.content);
              }
            }}
            className="input min-h-[60px] w-full resize-none text-sm"
            disabled={saving}
          />
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
          </div>
        </div>
      ) : (
        <div className="group relative">
          {editable && (
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit note"
              className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center text-xs text-text-faint hover:text-accent [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
            >
              ✎
            </button>
          )}
          <p className="pr-6 text-sm text-text">{note.content}</p>
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {personName && note.person_id && (
            <Link href={`/people/${note.person_id}`} className="text-xs text-accent hover:underline">
              {personName}
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
