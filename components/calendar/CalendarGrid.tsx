"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createTaskSafe } from "@/lib/actions/tasks";
import type { Task, Client } from "@/lib/types";

export type CalendarDay = { dayNum: number | null; isToday: boolean };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
  year,
  month,
  weeks,
  tasksByDay,
  birthdaysByDay,
  clients,
}: {
  year: number;
  month: number;
  weeks: CalendarDay[][];
  tasksByDay: Record<number, Task[]>;
  birthdaysByDay: Record<number, { clientId: string; displayName: string }[]>;
  clients: Pick<Client, "id" | "display_name">[];
}) {
  const [quickAddDay, setQuickAddDay] = useState<number | null>(null);

  return (
    <div className="rounded border border-border">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-1.5 text-center font-mono text-[11px] uppercase text-text-faint"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((cell, i) => {
          const dayTasks = cell.dayNum ? (tasksByDay[cell.dayNum] ?? []) : [];
          const dayBirthdays = cell.dayNum ? (birthdaysByDay[cell.dayNum] ?? []) : [];
          return (
            <div
              key={i}
              className={`min-h-[90px] border-b border-r border-border-subtle p-1.5 ${
                cell.dayNum ? "" : "bg-bg-raised/30"
              } ${cell.isToday ? "bg-accent/5" : ""}`}
            >
              {cell.dayNum && (
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-xs ${
                      cell.isToday ? "font-bold text-accent" : "text-text-faint"
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  <button
                    onClick={() => setQuickAddDay(cell.dayNum)}
                    className="text-text-faint opacity-0 hover:text-accent hover:opacity-100 focus:opacity-100"
                    aria-label="Add task"
                  >
                    +
                  </button>
                </div>
              )}
              <div className="mt-1 space-y-0.5">
                {dayBirthdays.map((b) => (
                  <Link
                    key={b.clientId}
                    href={`/clients/${b.clientId}`}
                    className="block truncate text-[11px] text-accent hover:underline"
                    title={`${b.displayName}'s birthday`}
                  >
                    🎂 {b.displayName}
                  </Link>
                ))}
                {dayTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks#${task.id}`}
                    className={`block truncate text-[11px] hover:underline ${
                      task.completed ? "text-text-faint line-through" : "text-text-muted"
                    }`}
                    title={task.title}
                  >
                    {task.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={quickAddDay !== null}
        onClose={() => setQuickAddDay(null)}
        title={quickAddDay ? `New task — ${month}/${quickAddDay}/${year}` : "New task"}
      >
        {quickAddDay !== null && (
          <QuickAddTaskForm
            year={year}
            month={month}
            day={quickAddDay}
            clients={clients}
            onDone={() => setQuickAddDay(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function QuickAddTaskForm({
  year,
  month,
  day,
  clients,
  onDone,
}: {
  year: number;
  month: number;
  day: number;
  clients: Pick<Client, "id" | "display_name">[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const dueAt = new Date(year, month - 1, day, 9, 0, 0).toISOString();
    const result = await createTaskSafe({ title, clientId: clientId || null, dueAt });
    setSaving(false);
    if (result.ok) {
      onDone();
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="input"
        placeholder="Call Marcus about interview"
      />
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
        <option value="">No client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.display_name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={saving || !title.trim()} className="w-full">
        {saving ? "Saving..." : "Add task"}
      </Button>
    </form>
  );
}
