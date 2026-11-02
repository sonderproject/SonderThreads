"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteCheckIn, restoreCheckIn, updateCheckInSafe } from "@/lib/actions/check-ins";
import { useUndo } from "@/components/ui/UndoToast";
import { formatCheckInDay, formatCheckInTime, fromLocalInputValue, toLocalInputValue } from "./time";
import type { CheckInWithPerson } from "@/lib/types";

export function CheckInRow({
  checkIn,
  showPerson = true,
  showDay = false,
}: {
  checkIn: CheckInWithPerson;
  showPerson?: boolean;
  showDay?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(() => toLocalInputValue(checkIn.checked_in_at));
  const [reason, setReason] = useState(checkIn.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const undo = useUndo();

  function cancel() {
    setEditing(false);
    setWhen(toLocalInputValue(checkIn.checked_in_at));
    setReason(checkIn.reason ?? "");
    setError(null);
  }

  async function save() {
    const checkedInAt = fromLocalInputValue(when);
    if (!checkedInAt) return setError("Pick a date and time");
    setSaving(true);
    setError(null);
    const result = await updateCheckInSafe(checkIn.id, { checkedInAt, reason: reason || null });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    await deleteCheckIn(checkIn.id);
    setEditing(false);
    router.refresh();
    undo.show("Check-in deleted", async () => {
      await restoreCheckIn(checkIn.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="space-y-2 px-3 py-2.5">
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="input tabular-nums"
            disabled={saving}
          />
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            placeholder="Reason"
            maxLength={500}
            className="input"
            disabled={saving}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="text-xs text-accent hover:underline disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={cancel} className="text-xs text-text-muted hover:text-text">
            Cancel
          </button>
          <button onClick={remove} className="ml-auto text-xs text-danger hover:underline">
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5">
      <span className="w-20 shrink-0 pt-0.5 tabular-nums text-xs text-text-faint">
        {showDay && <span className="block">{formatCheckInDay(checkIn.checked_in_at)}</span>}
        {formatCheckInTime(checkIn.checked_in_at)}
      </span>
      <div className="min-w-0 flex-1">
        {showPerson && (
          <Link href={`/people/${checkIn.person_id}`} className="text-sm font-semibold text-text hover:text-accent">
            {checkIn.display_name}
          </Link>
        )}
        <p className={`text-sm ${checkIn.reason ? "text-text-muted" : "text-text-faint"}`}>
          {checkIn.reason || "No reason given"}
        </p>
      </div>
      <button
        onClick={() => setEditing(true)}
        aria-label="Edit check-in"
        className="flex h-9 w-9 shrink-0 items-center justify-center text-xs text-text-faint hover:text-accent [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
      >
        ✎
      </button>
    </div>
  );
}
