"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useTerms } from "@/components/TermsProvider";
import { addOutcome, moveOutcome, renameOutcome, setOutcomeArchived } from "@/lib/actions/outcomes";
import type { Outcome } from "@/lib/outcomes";

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;

/** Settings → Outcomes: the results you track, recorded on a person's profile and counted in reports. */
export function OutcomesSettings({ outcomes, canManage, orgName }: { outcomes: Outcome[]; canManage: boolean; orgName: string | null }) {
  const terms = useTerms();
  const router = useRouter();
  const active = outcomes.filter((o) => !o.archived);
  const archived = outcomes.filter((o) => o.archived);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run: Run = (fn, after) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      after?.();
      router.refresh();
    });
  };

  return (
    <>
      <div className="card space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Results you track</h3>
          <p className="text-xs text-text-muted">
            Record one on a person&apos;s profile when it happens. {terms.impact} counts how many people reached each one, so your report shows
            results, not just activity.
            {orgName && !canManage ? ` Only ${orgName}'s admins can change this list.` : ""}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}

        {active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-text-faint">
            No outcomes yet. {canManage ? "Add your first one below." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border">
            {active.map((o, i) => (
              <OutcomeRow key={o.id} outcome={o} canManage={canManage} first={i === 0} last={i === active.length - 1} pending={pending} run={run} />
            ))}
          </ul>
        )}

        {canManage && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => addOutcome({ name }),
                () => setName(""),
              );
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input min-w-0 flex-[2_1_12rem]"
              placeholder="Outcome, e.g. Got a job or Became a regular"
              maxLength={80}
              aria-label="New outcome name"
            />
            <Button type="submit" disabled={pending || !name.trim()}>
              Add
            </Button>
          </form>
        )}
      </div>

      {archived.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-medium text-text">Retired outcomes ({archived.length})</summary>
          <p className="mt-1 text-xs text-text-muted">Kept for past reports. They can&apos;t be recorded anymore.</p>
          <ul className="mt-2 divide-y divide-border-subtle">
            {archived.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-text-muted">{o.name}</span>
                {canManage && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setOutcomeArchived(o.id, false))}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Bring back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function OutcomeRow({
  outcome,
  canManage,
  first,
  last,
  pending,
  run,
}: {
  outcome: Outcome;
  canManage: boolean;
  first: boolean;
  last: boolean;
  pending: boolean;
  run: Run;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(outcome.name);

  if (editing) {
    return (
      <li className="flex flex-wrap gap-2 p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input min-w-0 flex-[2_1_12rem]" maxLength={80} aria-label="Outcome name" />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !name.trim()} onClick={() => run(() => renameOutcome(outcome.id, { name }), () => setEditing(false))}>
            Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 p-3">
      <p className="min-w-0 flex-1 truncate text-sm text-text">{outcome.name}</p>
      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled={pending || first}
            onClick={() => run(() => moveOutcome(outcome.id, -1))}
            aria-label={`Move ${outcome.name} up`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={pending || last}
            onClick={() => run(() => moveOutcome(outcome.id, 1))}
            aria-label={`Move ${outcome.name} down`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-hover disabled:opacity-30"
          >
            ↓
          </button>
          <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2.5 py-1 text-xs font-medium text-accent hover:bg-bg-hover">
            Rename
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setOutcomeArchived(outcome.id, true))}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-bg-hover"
          >
            Retire
          </button>
        </div>
      )}
    </li>
  );
}
