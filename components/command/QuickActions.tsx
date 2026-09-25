"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createPersonRecordSafe } from "@/lib/actions/people";
import { createNoteSafe } from "@/lib/actions/notes";
import { createListSafe } from "@/lib/actions/lists";
import { createTaskSafe } from "@/lib/actions/tasks";
import { RecurrenceSelect } from "@/components/tasks/RecurrenceSelect";
import type { Person, TaskRecurrence } from "@/lib/types";
import { Dictate } from "@/components/voice/Dictate";

type ActiveModal = "person" | "note" | "list" | "task" | null;

export function QuickActions({ people }: { people: Pick<Person, "id" | "display_name">[] }) {
  const [active, setActive] = useState<ActiveModal>(null);
  const router = useRouter();

  function close() {
    setActive(null);
    router.refresh();
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-xs text-text-muted">
        {(["person", "note", "list", "task"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setActive(type)}
            className="rounded border border-border px-2 py-1 hover:border-accent hover:text-text transition-colors"
          >
            + {type}
          </button>
        ))}
      </div>

      <Modal open={active === "person"} onClose={close} title="New person">
        <PersonForm onDone={close} />
      </Modal>
      <Modal open={active === "note"} onClose={close} title="New note">
        <NoteForm people={people} onDone={close} />
      </Modal>
      <Modal open={active === "list"} onClose={close} title="New list">
        <ListForm onDone={close} />
      </Modal>
      <Modal open={active === "task"} onClose={close} title="New task">
        <TaskForm people={people} onDone={close} />
      </Modal>
    </>
  );
}

function PersonForm({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createPersonRecordSafe({
      fullName,
      currentStatus: currentStatus || null,
      nextAction: nextAction || null,
    });
    setSaving(false);
    if (result.ok) onDone();
    else setError(result.error);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Field label="Name">
        <Dictate value={fullName} onChange={setFullName}>
          <input
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input"
            placeholder="Marcus Johnson"
          />
        </Dictate>
      </Field>
      <Field label="Current (optional)">
        <Dictate value={currentStatus} onChange={setCurrentStatus}>
          <input
            value={currentStatus}
            onChange={(e) => setCurrentStatus(e.target.value)}
            className="input"
            placeholder="Starting Amazon Monday"
          />
        </Dictate>
      </Field>
      <Field label="Next (optional)">
        <Dictate value={nextAction} onChange={setNextAction}>
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            className="input"
            placeholder="Follow up after first week"
          />
        </Dictate>
      </Field>
      <Button type="submit" disabled={saving || !fullName.trim()} className="w-full">
        {saving ? "Saving..." : "Add person"}
      </Button>
    </form>
  );
}

function NoteForm({
  people,
  onDone,
}: {
  people: Pick<Person, "id" | "display_name">[];
  onDone: () => void;
}) {
  const [content, setContent] = useState("");
  const [personId, setPersonId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createNoteSafe({ content, personId: personId || null });
    setSaving(false);
    if (result.ok) onDone();
    else setError(result.error);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Field label="Note">
        <Dictate value={content} onChange={setContent}>
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input min-h-[80px] resize-none"
            placeholder="What's happening?"
          />
        </Dictate>
      </Field>
      <Field label="Person (optional)">
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input">
          <option value="">Standalone note</option>
          {people.map((c) => (
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
  const [isGroup, setIsGroup] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createListSafe({ name, isGroup, description: description || null });
    setSaving(false);
    if (result.ok) onDone();
    else setError(result.error);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Field label="Name">
        <Dictate value={name} onChange={setName}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Group 8"
          />
        </Dictate>
      </Field>
      <Field label="Description (optional)">
        <Dictate value={description} onChange={setDescription}>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
          />
        </Dictate>
      </Field>
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)} />
        This is a group (roster of people)
      </label>
      <Button type="submit" disabled={saving || !name.trim()} className="w-full">
        {saving ? "Saving..." : "Create list"}
      </Button>
    </form>
  );
}

function TaskForm({
  people,
  onDone,
}: {
  people: Pick<Person, "id" | "display_name">[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [personId, setPersonId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrence | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createTaskSafe({
      title,
      personId: personId || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      recurrence: recurrence || null,
    });
    setSaving(false);
    if (result.ok) onDone();
    else setError(result.error);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Field label="Task">
        <Dictate value={title} onChange={setTitle}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Call Marcus about interview"
          />
        </Dictate>
      </Field>
      <Field label="Person (optional)">
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input">
          <option value="">None</option>
          {people.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Due date (optional)">
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="input" />
      </Field>
      <Field label="Repeat">
        <RecurrenceSelect value={recurrence} onChange={setRecurrence} />
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
