"use client";

import { Modal } from "@/components/ui/Modal";
import { QuickAddTaskForm } from "@/components/calendar/QuickAddTaskForm";
import { longDayLabel, parseKey } from "@/lib/calendar-items";
import type { Person } from "@/lib/types";

/** Add a task due on a given day. */
export function NewCalendarTask({
  open,
  day,
  people,
  onClose,
}: {
  open: boolean;
  /** "YYYY-MM-DD" the task is due. */
  day: string;
  people: Pick<Person, "id" | "display_name">[];
  onClose: () => void;
}) {
  const { year, month, day: d } = parseKey(day);
  return (
    <Modal open={open} onClose={onClose} title={`New task · ${longDayLabel(day)}`}>
      <QuickAddTaskForm key={day} year={year} month={month} day={d} people={people} onDone={onClose} />
    </Modal>
  );
}
