"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createTaskSafe } from "@/lib/actions/tasks";
import type { Client } from "@/lib/types";

export function NewTaskButton({ clients }: { clients: Pick<Client, "id" | "display_name">[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New task">
        <NewTaskForm clients={clients} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function NewTaskForm({
  clients,
  onDone,
}: {
  clients: Pick<Client, "id" | "display_name">[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    startTransition(async () => {
      const result = await createTaskSafe({
        title,
        clientId: clientId || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
      setSaving(false);
      if (result.ok) {
        onDone();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-text-muted">Task</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="Call Marcus about interview"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Client (optional)</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
          <option value="">None</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Due date (optional)</label>
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="input" />
      </div>
      <Button type="submit" disabled={saving || pending || !title.trim()} className="w-full">
        {saving || pending ? "Saving..." : "Create task"}
      </Button>
    </form>
  );
}
