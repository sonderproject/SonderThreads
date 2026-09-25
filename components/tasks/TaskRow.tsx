"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setTaskCompleted, updateTaskSafe } from "@/lib/actions/tasks";
import { RecurrenceSelect } from "@/components/tasks/RecurrenceSelect";
import type { Task, TaskRecurrence } from "@/lib/types";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function TaskRow({
  task,
  personName,
}: {
  task: Task;
  personName?: string | null;
}) {
  const [completed, setCompleted] = useState(task.completed);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueAt, setDueAt] = useState(toDateInputValue(task.due_at));
  const [recurrence, setRecurrence] = useState<TaskRecurrence | "">(task.recurrence ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !completed;
    setCompleted(next);
    startTransition(async () => {
      await setTaskCompleted(task.id, next);
      router.refresh();
    });
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateTaskSafe(task.id, {
      title: title.trim(),
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      recurrence: recurrence || null,
    });
    setSaving(false);
    if (result.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  function cancel() {
    setEditing(false);
    setTitle(task.title);
    setDueAt(toDateInputValue(task.due_at));
    setRecurrence(task.recurrence ?? "");
    setError(null);
  }

  if (editing) {
    return (
      <div id={task.id} className="space-y-2 rounded px-2 py-2">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input text-sm"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="input text-sm"
          />
          <RecurrenceSelect value={recurrence} onChange={setRecurrence} className="input text-sm" />
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={cancel} className="text-xs text-text-muted hover:text-text">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id={task.id}
      className="group flex items-start gap-3 rounded px-3 py-3 hover:bg-bg-hover sm:px-2 sm:py-2"
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={toggle}
        disabled={pending}
        className="mt-0.5 h-5 w-5 shrink-0 accent-accent sm:h-4 sm:w-4"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${completed ? "text-text-faint line-through" : "text-text"}`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-text-muted">
          {personName && task.person_id && (
            <Link href={`/people/${task.person_id}`} className="hover:text-accent">
              {personName}
            </Link>
          )}
          {task.due_at && (
            <span>
              {new Date(task.due_at).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {task.recurrence && <span title={`Repeats ${task.recurrence}`}>↻ {task.recurrence}</span>}
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        aria-label="Edit task"
        className="-my-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded text-text-faint hover:text-accent [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
      >
        ✎
      </button>
    </div>
  );
}
