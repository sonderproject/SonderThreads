"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NoteCard } from "@/components/notes/NoteCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { createNoteSafe } from "@/lib/actions/notes";
import type { Client, Note } from "@/lib/types";

export function NotesBrowser({
  notes,
  clients,
}: {
  notes: Note[];
  clients: Client[];
}) {
  const [query, setQuery] = useState("");
  const [content, setContent] = useState("");
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const clientsById = new Map(clients.map((c) => [c.id, c]));

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
      const result = await createNoteSafe({ content, clientId: clientId || null });
      setSaving(false);
      if (result.ok) {
        setContent("");
        setClientId("");
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
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Quick note..."
          className="input min-h-[60px] resize-none font-mono"
        />
        <div className="flex gap-2">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input flex-1">
            <option value="">Standalone</option>
            {clients.map((c) => (
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

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notes..."
        className="input font-mono"
      />

      {filtered.length === 0 ? (
        <EmptyState message={notes.length === 0 ? "No notes yet." : "No matches."} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              clientName={note.client_id ? clientsById.get(note.client_id)?.display_name : null}
              editable
            />
          ))}
        </div>
      )}
    </div>
  );
}
