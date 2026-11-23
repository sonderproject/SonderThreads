"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTerms } from "@/components/TermsProvider";
import { exitPerson, removePersonExit, reopenPerson } from "@/lib/actions/exits";
import { EXIT_KINDS, exitKindLabel, type ExitKind } from "@/lib/exit-kinds";
import type { ExitReason, PersonExit as PersonExitRow } from "@/lib/exits";

const KIND_TONE: Record<ExitKind, string> = { positive: "tag-v", neutral: "", unplanned: "tag-e" };

/**
 * A person's exit: the "Exit from program" / "Mark as former customer" button and form,
 * the banner while they're exited (with re-enroll), and their exit history. The person
 * and everything about them stays; exits are counted in Impact / Insights.
 */
export function PersonExit({
  personId,
  personName,
  exits,
  reasons,
  me,
  isAdmin,
  today,
  dateLabel,
}: {
  personId: string;
  personName: string;
  exits: PersonExitRow[];
  reasons: ExitReason[];
  me: string;
  isAdmin: boolean;
  today: string;
  /** Formats a YYYY-MM-DD date for display. */
  dateLabel: Record<string, string>;
}) {
  const terms = useTerms();
  const router = useRouter();
  const current = exits.find((e) => !e.reopenedAt) ?? null;
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      if (!picked) return setError("Pick a reason.");
      const r = await exitPerson({ personId, reasonId: picked, exitedOn: day, note });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setPicked(null);
      setNote("");
      setDay(today);
      router.refresh();
    });

  const reopen = () =>
    start(async () => {
      const r = await reopenPerson(personId);
      if (!r.ok) setError(r.error);
      router.refresh();
    });

  const remove = (id: string, name: string) => {
    if (!window.confirm(`Remove this exit (${name})? It will no longer count in reports.`)) return;
    start(async () => {
      const r = await removePersonExit(id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {current ? (
        <div className="card flex flex-wrap items-center gap-3 p-4" style={{ borderColor: "var(--line)" }}>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
              {terms.exitedLabel} · {dateLabel[current.exitedOn] ?? current.exitedOn}
              <span className={`tag ${KIND_TONE[current.kind]} !ml-0`}>{exitKindLabel(current.kind)}</span>
            </p>
            <p className="text-sm text-text">{current.name}</p>
            {current.note && <p className="text-sm text-text-muted">{current.note}</p>}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={reopen}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover disabled:opacity-60"
          >
            {terms.reopenAction}
          </button>
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover"
        >
          {terms.exitAction}
        </button>
      ) : reasons.length === 0 ? (
        <p className="card p-3 text-sm text-text-muted">
          No exit reasons to pick from yet.{" "}
          <Link href="/settings/outcomes" className="text-accent hover:underline">
            Set them up in Settings → Outcomes &amp; exits
          </Link>
          .
        </p>
      ) : (
        <div className="card space-y-3 p-3">
          <p className="text-sm font-semibold text-text">
            {terms.exitWhy} <span className="font-normal text-text-muted">{personName} and their history stay in Surfdesk.</span>
          </p>
          {EXIT_KINDS.map((k) => {
            const rows = reasons.filter((r) => r.kind === k.kind);
            if (!rows.length) return null;
            return (
              <div key={k.kind} className="space-y-1.5">
                <p className="eyebrow text-text-faint">{k.label}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${k.label} reasons`}>
                  {rows.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={picked === r.id}
                      onClick={() => setPicked(r.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        picked === r.id ? "border-accent bg-accent text-bg" : "border-border text-text hover:bg-bg-hover"
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
                placeholder={terms.audience === "nonprofit" ? "e.g. Moved in with her sister in Fresno" : "e.g. Said they went with a cheaper option"}
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
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {error && !open && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {exits.length > 0 && (
        <details className="text-sm" open={exits.length > 1 && !current}>
          <summary className="cursor-pointer text-xs font-medium text-text-muted">Exit history ({exits.length})</summary>
          <ul className="card mt-2 divide-y divide-border-subtle">
            {exits.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                <span className={`tag ${KIND_TONE[e.kind]} !ml-0 mt-0.5`}>{exitKindLabel(e.kind)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text">{e.name}</span>
                  <span className="block text-xs text-text-muted">
                    {dateLabel[e.exitedOn] ?? e.exitedOn}
                    {e.recordedBy ? ` · ${e.recordedBy}` : ""}
                    {e.reopenedAt ? " · came back" : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </span>
                {(e.recordedById === me || isAdmin) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(e.id, e.name)}
                    aria-label={`Remove exit ${e.name}`}
                    className="shrink-0 rounded-full px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-danger"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
