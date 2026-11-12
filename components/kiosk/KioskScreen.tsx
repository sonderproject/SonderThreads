"use client";

import { useEffect, useState, useTransition } from "react";
import { exitKiosk, kioskCheckIn } from "@/lib/actions/kiosk";

const RESET_MS = 5000;

/**
 * The self check-in screen: big name fields and reason buttons, a thank-you,
 * then a reset for the next person. Shows nothing about other clients. A
 * small "Staff" link opens the PIN prompt to leave kiosk mode.
 */
export function KioskScreen({
  reasons,
  orgName,
  logoVersion,
  wrongPin,
  pinLocked = false,
}: {
  reasons: string[];
  orgName: string | null;
  logoVersion: string | null;
  wrongPin: boolean;
  /** Too many wrong PINs: exiting is locked for 15 minutes. */
  pinLocked?: boolean;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState(wrongPin);
  const [pending, startTransition] = useTransition();

  // Keep the session alive while the tablet waits at the desk.
  useEffect(() => {
    const ping = () => fetch("/api/auth/heartbeat", { method: "POST", cache: "no-store" }).catch(() => {});
    ping();
    const t = setInterval(ping, 4 * 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!thanks) return;
    const t = setTimeout(() => setThanks(null), RESET_MS);
    return () => clearTimeout(t);
  }, [thanks]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError("Please tap a reason for your visit.");
    setError(null);
    startTransition(async () => {
      const result = await kioskCheckIn(first, last, reason);
      if (!result.ok) return setError(result.error);
      setThanks(result.data.firstName);
      setFirst("");
      setLast("");
      setReason(null);
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          {logoVersion && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/org-logo?v=${logoVersion}`} alt="" className="max-h-12 max-w-40 rounded-lg bg-white object-contain p-1" />
          )}
          {orgName && <span className="font-display text-lg font-light text-text">{orgName}</span>}
        </div>
        <button type="button" onClick={() => setStaff((v) => !v)} className="text-xs text-text-muted hover:text-text">
          Staff
        </button>
      </header>

      {staff && (
        <form action={exitKiosk} className="mx-6 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-bg-raised p-3">
          <span className="text-sm text-text">Enter the staff PIN to leave kiosk mode</span>
          <input name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoFocus className="input w-28 text-center tabular-nums" />
          <button type="submit" className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg">
            Unlock
          </button>
          {wrongPin && (
            <span className="text-sm text-danger">{pinLocked ? "Too many wrong PINs. Try again in 15 minutes." : "Wrong PIN."}</span>
          )}
        </form>
      )}

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {thanks ? (
          <div className="space-y-3 text-center" role="status" aria-live="polite">
            <p className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent text-3xl text-bg">✓</p>
            <h1 className="font-display text-4xl font-light text-text">Thanks, {thanks}!</h1>
            <p className="text-lg text-text-muted">You&apos;re checked in. Please have a seat.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full max-w-xl space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="font-display text-4xl font-light text-text sm:text-5xl">Welcome! Please check in.</h1>
              <p className="text-text-muted">Type your name and tap why you&apos;re here today.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm text-text-muted">First name</span>
                <input
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  required
                  className="input py-4 text-xl"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-text-muted">Last name</span>
                <input
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  required
                  className="input py-4 text-xl"
                />
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-text-muted">Reason for your visit</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {reasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    aria-pressed={reason === r}
                    className={`rounded-2xl border px-4 py-4 text-base font-medium transition-colors ${
                      reason === r ? "border-accent bg-accent-soft text-accent" : "border-border bg-bg-raised text-text hover:bg-bg-hover"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-center text-danger">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-accent px-6 py-4 text-lg font-semibold text-bg hover:bg-accent-dim disabled:opacity-60"
            >
              {pending ? "Checking in…" : "Check in"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
