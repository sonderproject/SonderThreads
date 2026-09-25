"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NoteCard } from "@/components/notes/NoteCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { createNoteSafe } from "@/lib/actions/notes";
import type { Person, Note } from "@/lib/types";
import { Dictate } from "@/components/voice/Dictate";

export function NotesBrowser({
  notes,
  people,
}: {
  notes: Note[];
  people: Person[];
}) {
  const [query, setQuery] = useState("");
  const [content, setContent] = useState("");
  const [personId, setPersonId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const peopleById = new Map(people.map((c) => [c.id, c]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.content.toLowerCase().includes(q));
  }, [notes, query]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    startTransition(async () => {
      const result = await createNoteSafe({ content, personId: personId || null });
      setSaving(false);
      if (result.ok) {
        setContent("");
        setPersonId("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="space-y-2 rounded border border-border bg-bg-raised p-3">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Dictate value={content} onChange={setContent}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Quick note..."
            className="input min-h-[60px] resize-none font-mono"
          />
        </Dictate>
        <div className="flex gap-2">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input flex-1">
            <option value="">Standalone</option>
            {people.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={saving || pending || !content.trim()} className="shrink-0">
            {saving || pending ? "Saving..." : "Add note"}
          </Button>
        </div>
      </form>

      <Dictate value={query} onChange={setQuery}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
          className="input font-mono"
        />
      </Dictate>

      {filtered.length === 0 ? (
        <EmptyState message={notes.length === 0 ? "No notes yet." : "No matches."} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              personName={note.person_id ? peopleById.get(note.person_id)?.display_name : null}
              editable
            />
          ))}
        </div>
      )}
    </div>
  );
}
