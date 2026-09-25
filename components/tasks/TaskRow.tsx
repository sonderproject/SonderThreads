"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteTask, restoreTask, setTaskCompleted, updateTaskSafe } from "@/lib/actions/tasks";
import { RecurrenceSelect } from "@/components/tasks/RecurrenceSelect";
import { Modal } from "@/components/ui/Modal";
import { useUndo } from "@/components/ui/UndoToast";
import { snoozeOptions } from "@/components/tasks/snooze";
import { SnoozeIcon } from "@/components/ui/icons";
import type { Task, TaskRecurrence } from "@/lib/types";
import { formatDue } from "@/lib/format-due";
import { Dictate } from "@/components/voice/Dictate";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

/** How far (px) a swipe must travel to count; the row stops following at MAX_SWIPE. */
const SWIPE_TRIGGER = 80;
const MAX_SWIPE = 120;

export function TaskRow({
  task,
  personName,
}: {
  task: Task;
  personName?: string | null;
}) {
  const [completed, setCompleted] = useState(task.completed);
  const [editing, setEditing] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueAt, setDueAt] = useState(toDateInputValue(task.due_at));
  const [recurrence, setRecurrence] = useState<TaskRecurrence | "">(task.recurrence ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipe = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  const suppressClick = useRef(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const undo = useUndo();

  function setDone(next: boolean) {
    setCompleted(next);
    startTransition(async () => {
      await setTaskCompleted(task.id, next);
      router.refresh();
    });
    if (next) {
      undo.show(`Done: ${task.title}`, async () => {
        setCompleted(false);
        await setTaskCompleted(task.id, false);
        router.refresh();
      });
    }
  }

  async function snoozeTo(date: Date) {
    setSnoozing(false);
    // RSC hands dates over as Date objects despite the string type.
    const previous = task.due_at ? new Date(task.due_at).toISOString() : null;
    const result = await updateTaskSafe(task.id, { due_at: date.toISOString() });
    if (!result.ok) return;
    router.refresh();
    undo.show(
      `Snoozed to ${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`,
      async () => {
        await updateTaskSafe(task.id, { due_at: previous });
        router.refresh();
      },
    );
  }

  async function remove() {
    await deleteTask(task.id);
    setEditing(false);
    router.refresh();
    undo.show(`Deleted: ${task.title}`, async () => {
      await restoreTask(task.id);
      router.refresh();
    });
  }

  // Touch swipe: right = complete, left = snooze. Only horizontal drags are
  // captured; vertical ones are left to page scrolling.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    swipe.current = { x: e.clientX, y: e.clientY, locked: null };
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.locked = Math.abs(dx) > Math.abs(dy);
    }
    if (s.locked) setSwipeX(Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx)));
  }

  function onPointerEnd() {
    const s = swipe.current;
    swipe.current = null;
    if (!s?.locked) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 50);
    if (swipeX >= SWIPE_TRIGGER) setDone(!completed);
    else if (swipeX <= -SWIPE_TRIGGER && !completed) setSnoozing(true);
    setSwipeX(0);
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
      <div id={task.id} className="space-y-2 rounded px-3 py-3 sm:px-2 sm:py-2">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Dictate value={title} onChange={setTitle}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input text-sm"
          />
        </Dictate>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="input w-auto flex-1 text-sm"
          />
          <RecurrenceSelect value={recurrence} onChange={setRecurrence} className="input w-auto flex-1 text-sm" />
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="h-9 text-sm text-accent hover:underline disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={cancel} className="h-9 text-sm text-text-muted hover:text-text">
            Cancel
          </button>
          <button onClick={remove} className="ml-auto h-9 text-sm text-danger hover:underline">
            Delete
          </button>
        </div>
      </div>
    );
  }

  const swipeHint =
    swipeX > 0 ? (completed ? "↺ undo" : "✓ done") : swipeX < 0 && !completed ? "snooze" : "";

  return (
    <div id={task.id} className="relative overflow-hidden rounded">
      {swipeX !== 0 && (
        <div
          aria-hidden
          className={`absolute inset-0 flex items-center px-5 font-mono text-sm ${
            swipeX > 0 ? "justify-start text-accent" : "justify-end text-warn"
          }`}
          style={{ backgroundColor: swipeX > 0 ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "color-mix(in srgb, var(--color-warn) 15%, transparent)" }}
        >
          {swipeHint}
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        style={{
          transform: swipeX ? `translateX(${swipeX}px)` : undefined,
          transition: swipe.current ? "none" : "transform 150ms ease-out",
          touchAction: "pan-y",
        }}
        className="group relative flex items-start gap-3 bg-bg px-3 py-3 hover:bg-bg-hover sm:px-2 sm:py-2"
      >
        <input
          type="checkbox"
          checked={completed}
          onChange={() => setDone(!completed)}
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
            {task.due_at && <span>{formatDue(task.due_at)}</span>}
            {task.recurrence && <span title={`Repeats ${task.recurrence}`}>↻ {task.recurrence}</span>}
          </div>
        </div>
        {!completed && (
          <button
            onClick={() => setSnoozing(true)}
            aria-label="Snooze task"
            title="Snooze"
            className="-my-1 flex h-9 w-9 shrink-0 items-center justify-center rounded text-text-faint hover:text-accent [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          >
            <SnoozeIcon />
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          aria-label="Edit task"
          className="-my-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded text-text-faint hover:text-accent [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        >
          ✎
        </button>
      </div>

      <Modal open={snoozing} onClose={() => setSnoozing(false)} title="Snooze until">
        <SnoozePicker onPick={snoozeTo} />
      </Modal>
    </div>
  );
}

function SnoozePicker({ onPick }: { onPick: (date: Date) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <div className="space-y-3">
      <div className="divide-y divide-border-subtle rounded border border-border">
        {snoozeOptions().map((o) => (
          <button
            key={o.label}
            onClick={() => onPick(o.at)}
            className="flex h-12 w-full items-center justify-between px-4 text-left hover:bg-bg-hover"
          >
            <span className="text-base text-text sm:text-sm">{o.label}</span>
            <span className="font-mono text-sm text-text-muted">{o.hint}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="date" value={custom} onChange={(e) => setCustom(e.target.value)} className="input" />
        <button
          disabled={!custom}
          onClick={() => {
            const [y, m, d] = custom.split("-").map(Number);
            onPick(new Date(y, m - 1, d, 9, 0, 0));
          }}
          className="h-11 shrink-0 rounded bg-accent px-4 text-sm font-medium text-bg disabled:opacity-50 sm:h-9"
        >
          Set
        </button>
      </div>
    </div>
  );
}
