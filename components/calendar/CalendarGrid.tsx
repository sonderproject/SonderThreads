"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { QuickAddTaskForm } from "@/components/calendar/QuickAddTaskForm";
import type { CalendarDay } from "@/lib/calendar-utils";
import type { Task, Person } from "@/lib/types";

export type { CalendarDay };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
  year,
  month,
  weeks,
  tasksByDay,
  birthdaysByDay,
  people,
}: {
  year: number;
  month: number;
  weeks: CalendarDay[][];
  tasksByDay: Record<number, Task[]>;
  birthdaysByDay: Record<number, { personId: string; displayName: string }[]>;
  people: Pick<Person, "id" | "display_name">[];
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
                    key={b.personId}
                    href={`/people/${b.personId}`}
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
            people={people}
            onDone={() => setQuickAddDay(null)}
          />
        )}
      </Modal>
    </div>
  );
}
