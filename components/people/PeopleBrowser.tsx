"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PersonCard } from "@/components/people/PersonCard";
import { ImportPeopleButton } from "@/components/lists/ImportPeopleButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createPersonRecordSafe } from "@/lib/actions/people";
import type { Person } from "@/lib/types";
import { Dictate } from "@/components/voice/Dictate";

export function PeopleBrowser({ people }: { people: Person[] }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((c) =>
      [c.display_name, c.current_status, c.next_action, c.summary]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [people, query]);

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

      <a
        href="/api/export?format=csv"
        className="inline-block text-xs text-text-faint hover:text-accent"
      >
        Export roster as CSV
      </a>

      {filtered.length === 0 ? (
        <EmptyState message={people.length === 0 ? "No people yet." : "No matches."} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
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
