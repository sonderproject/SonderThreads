"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordOutcome, removePersonOutcome } from "@/lib/actions/outcomes";
import type { Outcome, PersonOutcome } from "@/lib/outcomes";

/**
 * A person's outcomes: what they've reached, with the date. "+ Outcome" picks
 * one from Settings → Outcomes (dated today unless changed). Whoever recorded
 * it, or an organization admin, can remove it.
 */
export function PersonOutcomes({
  personId,
  recorded,
  outcomes,
  me,
  isAdmin,
  today,
}: {
  personId: string;
  /** Each with its date already formatted on the server. */
  recorded: (PersonOutcome & { dateLabel: string })[];
  outcomes: Outcome[];
  me: string;
  isAdmin: boolean;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      if (!picked) return setError("Pick an outcome.");
      const r = await recordOutcome({ personId, outcomeId: picked, achievedOn: day, note });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setPicked(null);
      setNote("");
      setDay(today);
      router.refresh();
    });

  const remove = (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}"? It will no longer count in reports.`)) return;
    start(async () => {
      const r = await removePersonOutcome(id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {recorded.length > 0 && (
        <ul className="card divide-y divide-border-subtle">
          {recorded.map((o) => (
            <li key={o.id} className="flex items-start gap-3 px-3 py-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-bg" aria-hidden>
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text">{o.name}</span>
                <span className="block text-xs text-text-muted">
                  {o.dateLabel}
                  {o.recordedBy ? ` · ${o.recordedBy}` : ""}
                  {o.note ? ` · ${o.note}` : ""}
                </span>
              </span>
              {(o.recordedById === me || isAdmin) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(o.id, o.name)}
                  aria-label={`Remove ${o.name}`}
                  className="shrink-0 rounded-full px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-danger"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover"
        >
          + Outcome
        </button>
      ) : outcomes.length === 0 ? (
        <p className="card p-3 text-sm text-text-muted">
          No outcomes to pick from yet.{" "}
          <Link href="/settings/outcomes" className="text-accent hover:underline">
            Set them up in Settings → Outcomes
          </Link>
          .
        </p>
      ) : (
        <div className="card space-y-3 p-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Outcome">
            {outcomes.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={picked === o.id}
                onClick={() => setPicked(o.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  picked === o.id ? "border-accent bg-accent text-bg" : "border-border text-text hover:bg-bg-hover"
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="space-y-1">
              <span className="block text-xs text-text-muted">Date</span>
              <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="input w-auto" />
            </label>
            <label className="min-w-0 flex-1 space-y-1">
              <span className="block text-xs text-text-muted">Note (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="e.g. Full-time at Target"
                className="input"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-bg-hover">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || !picked}
              onClick={save}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save outcome"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
