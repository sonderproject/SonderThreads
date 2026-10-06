"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskRow } from "@/components/tasks/TaskRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useUndo } from "@/components/ui/UndoToast";
import { deleteTasks, restoreTasks } from "@/lib/actions/tasks";
import type { Task } from "@/lib/types";

export type TaskSectionData = { title: string; tasks: Task[]; empty: string };

/** The Tasks tab's sections, with Select → Delete for clearing out many tasks at once. */
export function TasksBrowser({
  sections,
  personNames,
  newButton,
}: {
  sections: TaskSectionData[];
  personNames: Record<string, string>;
  newButton: React.ReactNode;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const undo = useUndo();
  const hasTasks = sections.some((s) => s.tasks.length > 0);

  function toggle(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function handleDelete() {
    const ids = [...selected];
    const label = ids.length === 1 ? "1 task" : `${ids.length} tasks`;
    setDeleting(true);
    await deleteTasks(ids);
    setDeleting(false);
    stopSelecting();
    router.refresh();
    undo.show(`Deleted ${label}`, async () => {
      await restoreTasks(ids);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-mono text-xs uppercase tracking-wide text-text-faint">Tasks</h1>
        <div className="flex items-center gap-3">
          {hasTasks && !selecting && (
            <button onClick={() => setSelecting(true)} className="text-xs text-text-muted hover:text-accent">
              Select
            </button>
          )}
          {newButton}
        </div>
      </div>

      {selecting && (
        <div className="sticky top-16 z-10 -mt-4 flex flex-wrap items-center gap-2 rounded border border-border bg-bg-raised p-2">
          <span className="font-mono text-xs text-text-muted">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={stopSelecting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={selected.size === 0 || deleting}>
              {deleting ? "Deleting…" : `Delete${selected.size ? ` ${selected.size}` : ""}`}
            </Button>
          </div>
        </div>
      )}

      {sections.map(({ title, tasks, empty }) => {
        const ids = tasks.map((t) => t.id);
        const all = ids.length > 0 && ids.every((id) => selected.has(id));
        return (
          <section key={title}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-wide text-text-faint">{title}</h2>
              {selecting && ids.length > 0 && (
                <button onClick={() => toggle(ids, !all)} className="text-xs text-text-muted hover:text-accent">
                  {all ? "Select none" : "Select all"}
                </button>
              )}
            </div>
            {tasks.length === 0 ? (
              <EmptyState message={empty} />
            ) : (
              <div className="divide-y divide-border-subtle rounded border border-border">
                {tasks.map((task) =>
                  selecting ? (
                    <label
                      key={task.id}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-3 sm:px-2 sm:py-2 ${
                        selected.has(task.id) ? "bg-danger/5" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(task.id)}
                        onChange={(e) => toggle([task.id], e.target.checked)}
                        className="h-5 w-5 shrink-0 sm:h-4 sm:w-4"
                      />
                      <span className={`text-sm ${task.completed ? "text-text-faint line-through" : "text-text"}`}>
                        {task.title}
                      </span>
                    </label>
                  ) : (
                    <TaskRow
                      key={task.id}
                      task={task}
                      personName={task.person_id ? personNames[task.person_id] : null}
                    />
                  ),
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
