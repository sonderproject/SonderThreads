"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NoteCard } from "@/components/notes/NoteCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Dictate } from "@/components/voice/Dictate";
import { createNoteSafe } from "@/lib/actions/notes";
import type { Note } from "@/lib/types";

export function PersonNotes({
  personId,
  personName,
  notes,
}: {
  personId: string;
  personName: string;
  notes: Note[];
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createNoteSafe({
        content,
        personId,
        tzOffset: new Date().getTimezoneOffset(),
      });
      if (result.ok) {
        setContent("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="space-y-2 rounded border border-border bg-bg-raised p-3">
        {error && <p className="text-xs text-danger">{error}</p>}
        <Dictate value={content} onChange={setContent}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(e);
            }}
            placeholder={`Note about ${personName}...`}
            className="input min-h-[60px] resize-none"
            disabled={pending}
          />
        </Dictate>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !content.trim()}>
            {pending ? "Saving..." : "Add note"}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <EmptyState message="No notes yet." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} editable />
          ))}
        </div>
      )}
    </div>
  );
}
