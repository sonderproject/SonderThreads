"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { QuickAddTaskForm } from "@/components/calendar/QuickAddTaskForm";
import { useTerms } from "@/components/TermsProvider";
import { createCheckInSafe } from "@/lib/actions/check-ins";
import { fromLocalInputValue, toLocalInputValue } from "@/components/check-ins/time";
import { longDayLabel, parseKey } from "@/lib/calendar-items";
import { PROSE_INPUT } from "@/lib/input-props";
import type { Person } from "@/lib/types";

type People = Pick<Person, "id" | "display_name">[];

/** Add a task or a meeting/check-in on a given day. */
export function NewCalendarItem({
  open,
  day,
  today,
  people,
  onClose,
}: {
  open: boolean;
  /** "YYYY-MM-DD" the new item goes on. */
  day: string;
  today: string;
  people: People;
  onClose: () => void;
}) {
  const terms = useTerms();
  const [tab, setTab] = useState<"task" | "meeting">("task");
  const { year, month, day: d } = parseKey(day);

  return (
    <Modal open={open} onClose={onClose} title={`Add to ${longDayLabel(day)}`}>
      <div role="tablist" aria-label="What to add" className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-border p-1">
        {(
          [
            ["task", "Task"],
            ["meeting", terms.checkIn],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full py-1.5 text-sm font-medium transition-colors ${
              tab === key ? "bg-accent text-bg" : "text-text-muted hover:bg-bg-hover hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "task" ? (
        <QuickAddTaskForm key={day} year={year} month={month} day={d} people={people} onDone={onClose} />
      ) : (
        <QuickAddMeetingForm key={day} day={day} today={today} people={people} onDone={onClose} />
      )}
    </Modal>
  );
}

function QuickAddMeetingForm({ day, today, people, onDone }: { day: string; today: string; people: People; onDone: () => void }) {
  const terms = useTerms();
  const router = useRouter();
  // Today defaults to now; any other day to 9:00 AM.
  const [when, setWhen] = useState(() => (day === today ? toLocalInputValue(new Date()) : `${day}T09:00`));
  const [personId, setPersonId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!personId || !when) return;
    setError(null);
    startTransition(async () => {
      const result = await createCheckInSafe({ personId, checkedInAt: fromLocalInputValue(when), reason: reason || null });
      if (!result.ok) return setError(result.error);
      onDone();
      router.refresh();
    });
  }

  if (people.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
        Add someone on the People page first, then log a {terms.checkInLower} with them here.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-danger">{error}</p>}
      <label className="block">
        <span className="eyebrow mb-1 block">Person</span>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input" required autoFocus>
          <option value="">Choose a person</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow mb-1 block">When</span>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="input" required />
      </label>
      <label className="block">
        <span className="eyebrow mb-1 block">Reason (optional)</span>
        <input {...PROSE_INPUT} value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Housing follow-up" />
      </label>
      <Button type="submit" disabled={pending || !personId || !when} className="w-full">
        {pending ? "Saving..." : terms.logCheckIn}
      </Button>
    </form>
  );
}
