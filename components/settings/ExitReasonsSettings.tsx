"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useTerms } from "@/components/TermsProvider";
import { addExitReason, renameExitReason, setExitReasonArchived, setExitReasonKind } from "@/lib/actions/exits";
import { EXIT_KINDS, type ExitKind } from "@/lib/exit-kinds";
import type { ExitReason } from "@/lib/exits";

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;

const KIND_TONE: Record<ExitKind, string> = { positive: "tag-v", neutral: "", unplanned: "tag-e" };

/** Settings → Outcomes & exits: the reasons people leave, grouped positive / neutral / unplanned. */
export function ExitReasonsSettings({ reasons, canManage, orgName }: { reasons: ExitReason[]; canManage: boolean; orgName: string | null }) {
  const terms = useTerms();
  const router = useRouter();
  const active = reasons.filter((r) => !r.archived);
  const archived = reasons.filter((r) => r.archived);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ExitKind>("positive");
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
      <div className="card space-y-4 p-4">
        <div>
          <h3 className="text-sm font-semibold text-text">Exit reasons</h3>
          <p className="text-xs text-text-muted">
            Pick one when you use “{terms.exitAction}” on someone&apos;s profile. Their profile and history stay. {terms.impact} shows exits by reason
            and how many were positive, neutral or unplanned.
            {orgName && !canManage ? ` Only ${orgName}'s admins can change this list.` : ""}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}

        {EXIT_KINDS.map((k) => {
          const rows = active.filter((r) => r.kind === k.kind);
          return (
            <div key={k.kind} className="space-y-1.5">
              <p className="flex items-center gap-2">
                <span className={`tag ${KIND_TONE[k.kind]} !ml-0`}>{k.label}</span>
                <span className="text-xs text-text-muted">{k.hint}</span>
              </p>
              {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-text-faint">None yet.</p>
              ) : (
                <ul className="divide-y divide-border-subtle rounded-xl border border-border">
                  {rows.map((r) => (
                    <ReasonRow key={r.id} reason={r} canManage={canManage} pending={pending} run={run} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {canManage && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => addExitReason({ name, kind }),
                () => setName(""),
              );
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input min-w-0 flex-[2_1_12rem]"
              placeholder="Reason, e.g. Found housing or Chose another company"
              maxLength={80}
              aria-label="New exit reason"
            />
            <select value={kind} onChange={(e) => setKind(e.target.value as ExitKind)} className="input w-auto" aria-label="Group">
              {EXIT_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={pending || !name.trim()}>
              Add
            </Button>
          </form>
        )}
      </div>

      {archived.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer font-medium text-text">Retired exit reasons ({archived.length})</summary>
          <p className="mt-1 text-xs text-text-muted">Kept for past reports. They can&apos;t be picked anymore.</p>
          <ul className="mt-2 divide-y divide-border-subtle">
            {archived.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-text-muted">{r.name}</span>
                {canManage && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setExitReasonArchived(r.id, false))}
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

function ReasonRow({ reason, canManage, pending, run }: { reason: ExitReason; canManage: boolean; pending: boolean; run: Run }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(reason.name);

  if (editing) {
    return (
      <li className="flex flex-wrap gap-2 p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input min-w-0 flex-[2_1_12rem]" maxLength={80} aria-label="Reason name" />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !name.trim()} onClick={() => run(() => renameExitReason(reason.id, { name }), () => setEditing(false))}>
            Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <p className="min-w-0 flex-1 truncate text-sm text-text">{reason.name}</p>
      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
          <select
            value={reason.kind}
            disabled={pending}
            onChange={(e) => run(() => setExitReasonKind(reason.id, e.target.value as ExitKind))}
            className="rounded-full border border-border bg-bg px-2 py-1 text-xs text-text"
            aria-label={`Group for ${reason.name}`}
          >
            {EXIT_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2.5 py-1 text-xs font-medium text-accent hover:bg-bg-hover">
            Rename
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setExitReasonArchived(reason.id, true))}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-bg-hover"
          >
            Retire
          </button>
        </div>
      )}
    </li>
  );
}
