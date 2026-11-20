"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useTeam } from "@/components/messages/TeamContext";
import { listShareTargets, shareNote, shareTask, type ShareTarget } from "@/lib/actions/messages";
import { PROSE_INPUT } from "@/lib/input-props";

/**
 * "Share" on a note or task: posts it into a team chat or channel. Client notes
 * link to the client for teammates who can see them; personal notes and tasks go
 * as a copy (a task itself always stays private). Hidden outside organizations.
 */
export function ShareToTeam({ kind, id, className = "" }: { kind: "note" | "task"; id: string; className?: string }) {
  const { inOrg } = useTeam();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<ShareTarget[] | null>(null);
  const [to, setTo] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!inOrg) return null;

  async function start() {
    setOpen(true);
    setDone(null);
    setError(null);
    const t = (await listShareTargets()) ?? [];
    setTargets(t);
    setTo((cur) => cur || t[0]?.id || "");
  }

  async function send() {
    if (!to) return;
    setBusy(true);
    setError(null);
    const r = kind === "note" ? await shareNote(id, to, comment) : await shareTask(id, to, comment);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Couldn't share it.");
    else {
      setDone(targets?.find((t) => t.id === to)?.title ?? "the chat");
      setComment("");
    }
  }

  return (
    <>
      <button type="button" onClick={start} className={className || "text-xs text-text-muted hover:text-accent hover:underline"}>
        Share
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={kind === "note" ? "Share note with your team" : "Share a copy of this task"}>
        {done ? (
          <div className="space-y-3">
            <p className="text-sm">Shared to {done}.</p>
            <button onClick={() => setOpen(false)} className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent">
              Done
            </button>
          </div>
        ) : targets === null ? (
          <p className="text-sm text-text-muted">Loading chats…</p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-text-muted">No chats to share to yet. Start one in Messages.</p>
        ) : (
          <div className="space-y-3">
            <select value={to} onChange={(e) => setTo(e.target.value)} className="input">
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <textarea
              {...PROSE_INPUT}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Add a message (optional)"
              className="input"
            />
            <p className="text-xs text-text-muted">
              {kind === "task"
                ? "Sends a copy of the title and due date. The task stays private to you."
                : "Everyone in that chat will see this note. Client notes link to the client for teammates who can see them."}
            </p>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              onClick={send}
              disabled={busy || !to}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim disabled:opacity-50"
            >
              {busy ? "Sharing…" : "Share"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
