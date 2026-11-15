"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkInviteProgress, previewBulkInvites, sendBulkInvites, type BulkPreview } from "@/lib/actions/team-invites";
import { ORG_ROLES, ROLE_LABELS, type OrgRole } from "@/lib/org-roles";

const MAX_FILE_BYTES = 1024 * 1024;

/** Admin: invite many people at once from a pasted list or a CSV, with a preview before anything is sent. */
export function BulkInviteCard() {
  const [text, setText] = useState("");
  const [role, setRole] = useState<OrgRole>("case_manager");
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ id: string; total: number } | null>(null);
  const [progress, setProgress] = useState<{ emailed: number; failed: number; done: boolean } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // While a bulk send runs, check its progress every 2 seconds.
  useEffect(() => {
    if (!batch || progress?.done) return;
    const t = setInterval(async () => {
      const r = await bulkInviteProgress(batch.id);
      if (r.ok) {
        setProgress(r.data);
        if (r.data.done) router.refresh();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [batch, progress?.done, router]);

  async function readFile(file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES) return setError("That file is over 1 MB. Save just the email and role columns as CSV.");
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) return setError("Choose a .csv file (in Excel or Google Sheets: File → Download → CSV).");
    setText(await file.text());
    setPreview(null);
  }

  function check() {
    setError(null);
    start(async () => {
      const r = await previewBulkInvites(text, role);
      if (!r.ok) return setError(r.error);
      setPreview(r.data);
    });
  }

  function send() {
    setError(null);
    start(async () => {
      const r = await sendBulkInvites(text, role);
      if (!r.ok) return setError(r.error);
      setBatch({ id: r.data.batchId, total: r.data.total });
      setProgress({ emailed: 0, failed: 0, done: false });
      setPreview(null);
      setText("");
    });
  }

  const sendable = preview ? preview.toInvite + preview.resend : 0;

  if (batch && progress) {
    const pctDone = batch.total ? Math.round(((progress.emailed + progress.failed) / batch.total) * 100) : 100;
    return (
      <div className="card space-y-3 p-4">
        <h3 className="text-sm font-semibold text-text">Invite many people</h3>
        <p className="text-sm text-text">
          {progress.done
            ? `Done: ${progress.emailed} of ${batch.total} invites emailed.`
            : `Sending… ${progress.emailed} of ${batch.total} invites emailed.`}
        </p>
        <div className="progress-bar" role="progressbar" aria-valuenow={pctDone} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pctDone}%` }} />
        </div>
        {progress.done && progress.failed > 0 && (
          <p className="flag text-xs">
            {progress.failed} {progress.failed === 1 ? "email" : "emails"} didn&apos;t go out. Their invites are in the list below: use Copy link to send
            them yourself.
          </p>
        )}
        {progress.done && (
          <button
            type="button"
            onClick={() => {
              setBatch(null);
              setProgress(null);
            }}
            className="text-xs text-accent hover:underline"
          >
            Invite more people
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-text">Invite many people</h3>
        <p className="text-xs text-text-muted">
          Paste email addresses (one per line, or separated by commas), or upload a CSV from Excel or Google Sheets. Add a role column
          (Admin, Manager or Member) to give people different roles; anyone without one gets the role below.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        rows={5}
        spellCheck={false}
        placeholder={"ana@agency.org, Manager\nbo@agency.org\ncy@agency.org"}
        className="input font-mono text-xs"
        aria-label="Email addresses"
      />
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
          Upload CSV
        </button>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          Everyone else joins as
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as OrgRole);
              setPreview(null);
            }}
            className="input w-auto py-1 text-sm"
          >
            {ORG_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preview && (
        <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
          <p className="text-text">
            <strong>{preview.toInvite}</strong> new {preview.toInvite === 1 ? "invite" : "invites"}
            {preview.resend > 0 && `, ${preview.resend} invited before (they'll get a fresh link)`}.
          </p>
          <p className="text-xs text-text-muted">
            {ORG_ROLES.filter((r) => preview.byRole[r] > 0)
              .map((r) => `${preview.byRole[r]} ${ROLE_LABELS[r]}${preview.byRole[r] === 1 ? "" : "s"}`)
              .join(" · ")}
            {preview.members > 0 && ` · ${preview.members} already in your organization (skipped)`}
            {preview.duplicates > 0 && ` · ${preview.duplicates} duplicates removed`}
          </p>
          {preview.seatsLeft !== null && (
            <p className={`text-xs ${preview.seatsNeeded > 0 ? "text-danger" : "text-text-muted"}`}>
              {preview.seatsNeeded > 0
                ? `You need ${preview.seatsNeeded} more ${preview.seatsNeeded === 1 ? "seat" : "seats"}: ${preview.seatsLeft} left. Add seats in Billing first.`
                : `${preview.seatsLeft} ${preview.seatsLeft === 1 ? "seat" : "seats"} left; this uses ${preview.toInvite}.`}
            </p>
          )}
          {preview.invalid.length > 0 && (
            <p className="text-xs text-danger">
              {preview.invalid.length} {preview.invalid.length === 1 ? "line isn't" : "lines aren't"} a valid email and will be skipped:{" "}
              {preview.invalid.slice(0, 5).join(", ")}
              {preview.invalid.length > 5 ? "…" : ""}
            </p>
          )}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!preview ? (
          <button
            type="button"
            onClick={check}
            disabled={pending || !text.trim()}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50"
          >
            {pending ? "Checking…" : "Check the list"}
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={pending || sendable === 0 || preview.seatsNeeded > 0}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-50"
          >
            {pending ? "Sending…" : `Send ${sendable} ${sendable === 1 ? "invite" : "invites"}`}
          </button>
        )}
      </div>
    </div>
  );
}
