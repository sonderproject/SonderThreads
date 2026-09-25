"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { QuickAddTaskForm } from "@/components/calendar/QuickAddTaskForm";
import type { Person } from "@/lib/types";

export function NewCalendarEventButton({
  people,
}: {
  people: Pick<Person, "id" | "display_name">[];
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New task">
        <QuickAddTaskForm
          year={today.getFullYear()}
          month={today.getMonth() + 1}
          day={today.getDate()}
          people={people}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
