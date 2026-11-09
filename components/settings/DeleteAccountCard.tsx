"use client";

import { useState } from "react";
import { deleteAccount } from "@/app/login/actions";

/** Settings → Delete account: two steps (open, then type DELETE) before anything is removed. */
export function DeleteAccountCard({ error }: { error?: string }) {
  const [open, setOpen] = useState(Boolean(error));
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <section id="delete" className="card space-y-3 border-danger/40 p-4">
      <div>
        <h2 className="text-sm font-semibold text-danger">Delete account</h2>
        <p className="text-xs text-text-muted">
          Permanently deletes your account and everything in it: people, check-ins, lists, tasks, notes and settings.
          This can&apos;t be undone.
        </p>
      </div>
      {error === "last-admin" && (
        <p className="text-xs text-danger">
          You&apos;re the only admin of your organization. Make someone else an admin first, so your organization&apos;s
          clients have someone to go to.
        </p>
      )}
      {error === "delete-login" && (
        <p className="text-xs text-danger">
          Your data was deleted, but removing your sign-in didn&apos;t finish. Please try once more.
        </p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
        >
          Delete my account…
        </button>
      ) : (
        <form action={deleteAccount} onSubmit={() => setSubmitting(true)} className="space-y-2">
          <p className="text-sm text-text">
            Type <strong>DELETE</strong> to confirm.
          </p>
          {error === "confirm" && <p className="text-xs text-danger">Type DELETE exactly to confirm.</p>}
          <input
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="DELETE"
            className="input max-w-[12rem] tabular-nums"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={confirm.trim() !== "DELETE" || submitting}
              className="rounded bg-danger px-3 py-1.5 text-sm font-medium text-bg-raised hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Deleting…" : "Permanently delete everything"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
              }}
              className="rounded border border-border px-3 py-1.5 text-sm text-text hover:bg-bg-hover"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
