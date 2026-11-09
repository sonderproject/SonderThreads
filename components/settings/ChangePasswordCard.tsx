"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { changePassword } from "@/lib/actions/security";

/** Settings → Security → Password. */
export function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await changePassword(password, confirm);
      if (!result.ok) return setError(result.error);
      close();
      setNotice("Password changed. Other devices were signed out.");
    });
  }

  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-text">Password</h2>
        <p className="text-xs text-text-muted">Changing it signs you out everywhere else.</p>
      </div>
      {notice && <p className="text-xs text-accent">{notice}</p>}
      {!open ? (
        <Button
          variant="ghost"
          onClick={() => {
            setNotice(null);
            setOpen(true);
          }}
        >
          Change password
        </Button>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          {error && <p className="text-xs text-danger">{error}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            autoComplete="new-password"
            placeholder="New password (8+ characters)"
            className="input max-w-sm"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Type it again"
            className="input max-w-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save password"}
            </Button>
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
