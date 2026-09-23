"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createClientRecord } from "@/lib/actions/clients";
import { createNote } from "@/lib/actions/notes";
import { createList } from "@/lib/actions/lists";
import { createTask } from "@/lib/actions/tasks";
import type { Client } from "@/lib/types";

type ActiveModal = "client" | "note" | "list" | "task" | null;

export function QuickActions({ clients }: { clients: Pick<Client, "id" | "display_name">[] }) {
  const [active, setActive] = useState<ActiveModal>(null);
  const router = useRouter();

  function close() {
    setActive(null);
    router.refresh();
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-xs text-text-muted">
        {(["client", "note", "list", "task"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setActive(type)}
            className="rounded border border-border px-2 py-1 hover:border-accent hover:text-text transition-colors"
          >
            + {type}
          </button>
        ))}
      </div>

      <Modal open={active === "client"} onClose={close} title="New client">
        <ClientForm onDone={close} />
      </Modal>
      <Modal open={active === "note"} onClose={close} title="New note">
        <NoteForm clients={clients} onDone={close} />
      </Modal>
      <Modal open={active === "list"} onClose={close} title="New list">
        <ListForm onDone={close} />
      </Modal>
      <Modal open={active === "task"} onClose={close} title="New task">
        <TaskForm clients={clients} onDone={close} />
      </Modal>
    </>
  );
}

function ClientForm({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    await createClientRecord({
      fullName,
      currentStatus: currentStatus || null,
      nextAction: nextAction || null,
    });
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Name">
        <input
          autoFocus
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input"
          placeholder="Marcus Johnson"
        />
      </Field>
      <Field label="Current (optional)">
        <input
          value={currentStatus}
          onChange={(e) => setCurrentStatus(e.target.value)}
          className="input"
          placeholder="Starting Amazon Monday"
        />
      </Field>
      <Field label="Next (optional)">
        <input
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          className="input"
          placeholder="Follow up after first week"
        />
      </Field>
      <Button type="submit" disabled={saving || !fullName.trim()} className="w-full">
        {saving ? "Saving..." : "Add client"}
      </Button>
    </form>
  );
}

function NoteForm({
  clients,
  onDone,
}: {
  clients: Pick<Client, "id" | "display_name">[];
  onDone: () => void;
}) {
  const [content, setContent] = useState("");
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    await createNote({ content, clientId: clientId || null });
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Note">
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="input min-h-[80px] resize-none"
          placeholder="What's happening?"
        />
      </Field>
      <Field label="Client (optional)">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
          <option value="">Standalone note</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" disabled={saving || !content.trim()} className="w-full">
        {saving ? "Saving..." : "Save note"}
      </Button>
    </form>
  );
}

function ListForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [isCohort, setIsCohort] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await createList({ name, isCohort, description: description || null });
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Name">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="Cohort 8"
        />
      </Field>
      <Field label="Description (optional)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={isCohort} onChange={(e) => setIsCohort(e.target.checked)} />
        This is a cohort (roster of clients)
      </label>
      <Button type="submit" disabled={saving || !name.trim()} className="w-full">
        {saving ? "Saving..." : "Create list"}
      </Button>
    </form>
  );
}

function TaskForm({
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await createTask({
      title,
      clientId: clientId || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Task">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="Call Marcus about interview"
        />
      </Field>
      <Field label="Client (optional)">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
          <option value="">None</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Due date (optional)">
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="input" />
      </Field>
      <Button type="submit" disabled={saving || !title.trim()} className="w-full">
        {saving ? "Saving..." : "Create task"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-muted">{label}</label>
      {children}
    </div>
  );
}
