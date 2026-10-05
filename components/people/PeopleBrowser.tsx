"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PersonCard } from "@/components/people/PersonCard";
import { ImportPeopleButton } from "@/components/lists/ImportPeopleButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createPersonRecordSafe, deletePeople, restorePeople } from "@/lib/actions/people";
import { useUndo } from "@/components/ui/UndoToast";
import type { Person } from "@/lib/types";
import { Dictate } from "@/components/voice/Dictate";

export function PeopleBrowser({ people }: { people: Person[] }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const undo = useUndo();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((c) =>
      [c.display_name, c.current_status, c.next_action, c.summary]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [people, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  async function handleDeleteSelected() {
    const ids = [...selected];
    const label = ids.length === 1 ? "1 person" : `${ids.length} people`;
    if (!confirm(`Delete ${label}? Their notes and tasks stay, unlinked.`)) return;
    setDeleting(true);
    await deletePeople(ids);
    setDeleting(false);
    stopSelecting();
    router.refresh();
    undo.show(`Deleted ${label}`, async () => {
      await restorePeople(ids);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Dictate value={query} onChange={setQuery}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className="input font-mono"
          />
        </Dictate>
        <ImportPeopleButton />
        <Button onClick={() => setModalOpen(true)} className="shrink-0">
          + New
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <a href="/api/export?format=csv" className="text-xs text-text-faint hover:text-accent">
          Export roster as CSV
        </a>
        {people.length > 0 && !selecting && (
          <button onClick={() => setSelecting(true)} className="text-xs text-text-muted hover:text-accent">
            Select
          </button>
        )}
      </div>

      {selecting && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded border border-border bg-bg-raised p-2">
          <span className="font-mono text-xs text-text-muted">{selected.size} selected</span>
          <button
            onClick={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                for (const p of filtered) {
                  if (allFilteredSelected) next.delete(p.id);
                  else next.add(p.id);
                }
                return next;
              })
            }
            className="text-xs text-text-muted hover:text-accent"
          >
            {allFilteredSelected ? "Select none" : "Select all"}
          </button>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={stopSelecting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteSelected} disabled={selected.size === 0 || deleting}>
              {deleting ? "Deleting…" : `Delete${selected.size ? ` ${selected.size}` : ""}`}
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message={people.length === 0 ? "No people yet." : "No matches."} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((person) =>
            selecting ? (
              <label
                key={person.id}
                className={`flex cursor-pointer items-center gap-3 rounded border p-4 transition-colors ${
                  selected.has(person.id) ? "border-danger/60 bg-danger/5" : "border-border bg-bg-raised"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(person.id)}
                  onChange={() => toggle(person.id)}
                  className="h-4 w-4"
                />
                <span className="font-medium text-text">{person.display_name}</span>
              </label>
            ) : (
              <PersonCard key={person.id} person={person} />
            ),
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New person">
        <NewPersonForm onDone={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

function NewPersonForm({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    setError(null);
    startTransition(async () => {
      const result = await createPersonRecordSafe({
        fullName,
        currentStatus: currentStatus || null,
        nextAction: nextAction || null,
      });
      setSaving(false);
      if (result.ok) {
        onDone();
        router.push(`/people/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-text-muted">Name</label>
        <Dictate value={fullName} onChange={setFullName}>
          <input
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input"
            placeholder="Marcus Johnson"
          />
        </Dictate>
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Current (optional)</label>
        <Dictate value={currentStatus} onChange={setCurrentStatus}>
          <input
            value={currentStatus}
            onChange={(e) => setCurrentStatus(e.target.value)}
            className="input"
            placeholder="Starting Amazon Monday"
          />
        </Dictate>
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Next (optional)</label>
        <Dictate value={nextAction} onChange={setNextAction}>
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            className="input"
            placeholder="Follow up after first week"
          />
        </Dictate>
      </div>
      <Button type="submit" disabled={saving || pending || !fullName.trim()} className="w-full">
        {saving || pending ? "Saving..." : "Add person"}
      </Button>
    </form>
  );
}
