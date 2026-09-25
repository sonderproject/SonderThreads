"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createTaskSafe } from "@/lib/actions/tasks";
import { RecurrenceSelect } from "@/components/tasks/RecurrenceSelect";
import type { Person, TaskRecurrence } from "@/lib/types";
import { Dictate } from "@/components/voice/Dictate";

function toDateInputValue(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function QuickAddTaskForm({
  year,
  month,
  day,
  people,
  onDone,
}: {
  year: number;
  month: number;
  day: number;
  people: Pick<Person, "id" | "display_name">[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateInputValue(year, month, day));
  const [personId, setPersonId] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrence | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    setError(null);
    const [y, m, d] = date.split("-").map(Number);
    const dueAt = new Date(y, m - 1, d, 9, 0, 0).toISOString();
    const result = await createTaskSafe({ title, personId: personId || null, dueAt, recurrence: recurrence || null });
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
      <Dictate value={title} onChange={setTitle}>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="Call Marcus about interview"
        />
      </Dictate>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
      <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input">
        <option value="">No person</option>
        {people.map((c) => (
          <option key={c.id} value={c.id}>
            {c.display_name}
          </option>
        ))}
      </select>
      <RecurrenceSelect value={recurrence} onChange={setRecurrence} />
      <Button type="submit" disabled={saving || !title.trim() || !date} className="w-full">
        {saving ? "Saving..." : "Add task"}
      </Button>
    </form>
  );
}
