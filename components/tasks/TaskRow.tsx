"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setTaskCompleted } from "@/lib/actions/tasks";
import type { Task } from "@/lib/types";

export function TaskRow({
  task,
  clientName,
}: {
  task: Task;
  clientName?: string | null;
}) {
  const [completed, setCompleted] = useState(task.completed);
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

  return (
    <div
      id={task.id}
      className="flex items-start gap-3 rounded px-2 py-2 hover:bg-bg-hover"
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={toggle}
        disabled={pending}
        className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${completed ? "text-text-faint line-through" : "text-text"}`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-text-muted">
          {clientName && task.client_id && (
            <Link href={`/clients/${task.client_id}`} className="hover:text-accent">
              {clientName}
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
        </div>
      </div>
    </div>
  );
}
