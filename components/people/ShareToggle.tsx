"use client";

import { useState, useTransition } from "react";
import { setPersonShared } from "@/lib/actions/people";

/** On a person's profile (org members only): shared with the organization, or private. */
export function ShareToggle({ personId, shared, orgName }: { personId: string; shared: boolean; orgName: string }) {
  const [isShared, setIsShared] = useState(shared);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    if (next === isShared) return;
    if (!next && !confirm(`Make private? ${orgName} will no longer see this person, their notes, tasks or check-ins. This is recorded in ${orgName}'s activity log.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await setPersonShared(personId, next);
      if (!result.ok) return setError(result.error);
      setIsShared(next);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="inline-flex rounded-full border border-border bg-bg-raised p-0.5" role="group" aria-label="Who can see this person">
        {[
          [true, `Shared with ${orgName}`],
          [false, "Private"],
        ].map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            disabled={pending}
            onClick={() => change(value as boolean)}
            aria-pressed={isShared === value}
            className={`rounded-full px-3 py-1 font-medium ${isShared === value ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}
          >
            {label as string}
          </button>
        ))}
      </div>
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
}
