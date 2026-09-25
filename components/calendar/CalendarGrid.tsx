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
  const todayCell = weeks.flat().find((c) => c.isToday);
  const [selectedDay, setSelectedDay] = useState<number>(todayCell?.dayNum ?? 1);

  return (
    <>
      <MobileMonth
        year={year}
        month={month}
        weeks={weeks}
        tasksByDay={tasksByDay}
        birthdaysByDay={birthdaysByDay}
        selectedDay={selectedDay}
        onSelect={setSelectedDay}
        onAdd={() => setQuickAddDay(selectedDay)}
      />
      <div className="hidden rounded border border-border sm:block">
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
    </>
  );
}

function MobileMonth({
  year,
  month,
  weeks,
  tasksByDay,
  birthdaysByDay,
  selectedDay,
  onSelect,
  onAdd,
}: {
  year: number;
  month: number;
  weeks: CalendarDay[][];
  tasksByDay: Record<number, Task[]>;
  birthdaysByDay: Record<number, { personId: string; displayName: string }[]>;
  selectedDay: number;
  onSelect: (day: number) => void;
  onAdd: () => void;
}) {
  const dayTasks = tasksByDay[selectedDay] ?? [];
  const dayBirthdays = birthdaysByDay[selectedDay] ?? [];
  const label = new Date(year, month - 1, selectedDay).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4 sm:hidden">
      <div className="rounded border border-border p-2">
        <div className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((l) => (
            <div key={l} className="py-1 text-center font-mono text-xs uppercase text-text-faint">
              {l[0]}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((cell, i) => {
            if (!cell.dayNum) return <div key={i} className="h-12" />;
            const day = cell.dayNum;
            const hasItems = (tasksByDay[day]?.length ?? 0) + (birthdaysByDay[day]?.length ?? 0) > 0;
            const selected = day === selectedDay;
            return (
              <button
                key={i}
                onClick={() => onSelect(day)}
                aria-pressed={selected}
                aria-label={`${month}/${day}/${year}${hasItems ? ", has items" : ""}`}
                className={`flex h-12 flex-col items-center justify-center rounded font-mono text-base ${
                  selected
                    ? "bg-accent text-bg"
                    : cell.isToday
                      ? "text-accent"
                      : "text-text-muted"
                }`}
              >
                {day}
                <span
                  className={`mt-0.5 h-1 w-1 rounded-full ${
                    hasItems ? (selected ? "bg-bg" : "bg-accent") : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-mono text-sm uppercase tracking-wide text-text-faint">{label}</h2>
          <button onClick={onAdd} className="h-10 rounded px-3 font-mono text-sm text-accent">
            + add
          </button>
        </div>
        {dayTasks.length === 0 && dayBirthdays.length === 0 ? (
          <p className="rounded border border-dashed border-border px-4 py-6 text-center text-sm text-text-faint">
            Nothing on this day.
          </p>
        ) : (
          <div className="divide-y divide-border-subtle rounded border border-border">
            {dayBirthdays.map((b) => (
              <Link key={b.personId} href={`/people/${b.personId}`} className="flex min-h-12 items-center px-4 text-accent">
                🎂 {b.displayName}&apos;s birthday
              </Link>
            ))}
            {dayTasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks#${task.id}`}
                className={`flex min-h-12 items-center px-4 ${task.completed ? "text-text-faint line-through" : "text-text"}`}
              >
                {task.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
