"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClientCard } from "@/components/clients/ClientCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createClientRecord } from "@/lib/actions/clients";
import type { Client } from "@/lib/types";

export function ClientsBrowser({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.display_name, c.current_status, c.next_action, c.summary]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [clients, query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients..."
          className="input font-mono"
        />
        <Button onClick={() => setModalOpen(true)} className="shrink-0">
          + New
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={clients.length === 0 ? "No clients yet." : "No matches."} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New client">
        <NewClientForm onDone={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

function NewClientForm({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    startTransition(async () => {
      const client = await createClientRecord({
        fullName,
        currentStatus: currentStatus || null,
        nextAction: nextAction || null,
      });
      setSaving(false);
      onDone();
      router.push(`/clients/${client.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-text-muted">Name</label>
        <input
          autoFocus
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input"
          placeholder="Marcus Johnson"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Current (optional)</label>
        <input
          value={currentStatus}
          onChange={(e) => setCurrentStatus(e.target.value)}
          className="input"
          placeholder="Starting Amazon Monday"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Next (optional)</label>
        <input
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          className="input"
          placeholder="Follow up after first week"
        />
      </div>
      <Button type="submit" disabled={saving || pending || !fullName.trim()} className="w-full">
        {saving || pending ? "Saving..." : "Add client"}
      </Button>
    </form>
  );
}
