"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createTaskSafe } from "@/lib/actions/tasks";
import type { Client } from "@/lib/types";

function toDateInputValue(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function QuickAddTaskForm({
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
  const [date, setDate] = useState(toDateInputValue(year, month, day));
  const [clientId, setClientId] = useState("");
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
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
        <option value="">No client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.display_name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={saving || !title.trim() || !date} className="w-full">
        {saving ? "Saving..." : "Add task"}
      </Button>
    </form>
  );
}
