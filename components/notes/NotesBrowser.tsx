"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NoteCard } from "@/components/notes/NoteCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { createNoteSafe } from "@/lib/actions/notes";
import type { Person, Note } from "@/lib/types";
import { Dictate } from "@/components/voice/Dictate";
import { PROSE_INPUT, SEARCH_INPUT } from "@/lib/input-props";
import { fuzzyFilter } from "@/lib/fuzzy";
import { SearchPicker } from "@/components/ui/SearchPicker";
import { autoGrow } from "@/lib/auto-grow";

type Filter = "all" | "person" | "standalone" | `cat:${string}`;

/** Today / Yesterday / This week / This month / Older, by the note's local date. */
function dayGroup(iso: string, now: Date): string {
  const d = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= start) return "Today";
  if (t >= start - 86_400_000) return "Yesterday";
  if (t >= start - 6 * 86_400_000) return "This week";
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "Earlier this month";
  return d.toLocaleDateString(undefined, { month: "long", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

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
  const peopleById = useMemo(() => new Map(people.map((c) => [c.id, c])), [people]);

  const [filter, setFilter] = useState<Filter>("all");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const pickerOptions = useMemo(() => people.map((p) => ({ id: p.id, label: p.display_name })), [people]);
  const categories = useMemo(
    () => [...new Set(notes.map((n) => n.category).filter((c): c is string => Boolean(c)))].sort(),
    [notes],
  );

  const filtered = useMemo(() => {
    const scoped = notes.filter((n) =>
      filter === "all"
        ? true
        : filter === "person"
          ? Boolean(n.person_id)
          : filter === "standalone"
            ? !n.person_id
            : n.category === filter.slice(4),
    );
    return fuzzyFilter(scoped, query, (n) => [
      n.content,
      { text: n.person_id ? peopleById.get(n.person_id)?.display_name : null, weight: 0.9 },
    ]);
  }, [notes, query, peopleById, filter]);

  // Pinned first, then by day. While searching, keep the best matches on top instead.
  const groups = useMemo(() => {
    if (query.trim()) return [{ label: "", notes: filtered }];
    const now = new Date();
    const out: { label: string; notes: Note[] }[] = [];
    const pinned = filtered.filter((n) => n.pinned_at);
    if (pinned.length) out.push({ label: "Pinned", notes: pinned });
    for (const n of filtered) {
      if (n.pinned_at) continue;
      const label = dayGroup(n.created_at, now);
      const g = out[out.length - 1];
      if (g && g.label === label) g.notes.push(n);
      else out.push({ label, notes: [n] });
    }
    return out;
  }, [filtered, query]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    startTransition(async () => {
      const result = await createNoteSafe({ content, personId: personId || null, tzOffset: new Date().getTimezoneOffset() });
      setSaving(false);
      if (result.ok) {
        setContent("");
        setPersonId("");
        requestAnimationFrame(() => autoGrow(textRef.current));
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="space-y-2 card p-3">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Dictate value={content} onChange={setContent}>
          <textarea
            {...PROSE_INPUT}
            ref={textRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              autoGrow(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(e);
            }}
            placeholder="Quick note..."
            className="input min-h-[60px] resize-none tabular-nums"
          />
        </Dictate>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {personId ? (
              <div className="flex h-full min-h-[42px] items-center gap-2 rounded border border-border bg-bg-raised px-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-text">For {peopleById.get(personId)?.display_name}</span>
                <button
                  type="button"
                  onClick={() => setPersonId("")}
                  aria-label="Remove person"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover hover:text-text"
                >
                  ✕
                </button>
              </div>
            ) : (
              <SearchPicker
                options={pickerOptions}
                onPick={(o) => setPersonId(o.id)}
                placeholder="About someone? Type a name (optional)"
                emptyMessage="No one by that name"
              />
            )}
          </div>
          <Button type="submit" disabled={saving || pending || !content.trim()} className="shrink-0">
            {saving || pending ? "Saving..." : "Add note"}
          </Button>
        </div>
      </form>

      <Dictate value={query} onChange={setQuery}>
        <input
          {...SEARCH_INPUT}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
          className="input tabular-nums"
        />
      </Dictate>

      {notes.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show notes">
          {(
            [
              ["all", "All"],
              ["person", "About someone"],
              ["standalone", "Standalone"],
              ...categories.map((c) => [`cat:${c}`, c[0].toUpperCase() + c.slice(1)] as const),
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === key
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-bg-raised text-text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message={notes.length === 0 ? "No notes yet." : "No matches."} />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.label || "results"} className="space-y-2">
              {g.label && <h2 className="eyebrow text-text-muted">{g.label}</h2>}
              <div className="grid gap-2 sm:grid-cols-2">
                {g.notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    personName={note.person_id ? peopleById.get(note.person_id)?.display_name : null}
                    editable
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
