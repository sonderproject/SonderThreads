"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { confirmTotpEnroll, disableTotp, startTotpEnroll, type TotpEnrollment } from "@/lib/actions/security";

/** Settings → Security: turn authenticator-app 2FA on (QR + first code) or off (needs a current code). */
export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const [mode, setMode] = useState<"idle" | "enrolling" | "disabling">("idle");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setMode("idle");
    setEnrollment(null);
    setCode("");
    setError(null);
  }

  function begin() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await startTotpEnroll();
      if (!result.ok) return setError(result.error);
      setEnrollment(result.data);
      setMode("enrolling");
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        mode === "enrolling" && enrollment ? await confirmTotpEnroll(enrollment.factorId, code) : await disableTotp(code);
      if (!result.ok) return setError(result.error);
      setNotice(mode === "enrolling" ? "Two-factor authentication is on." : "Two-factor authentication is off.");
      reset();
      router.refresh();
    });
  }

  return (
    <section id="two-factor" className="card scroll-mt-20 space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Two-factor authentication</h2>
          <p className="text-xs text-text-muted">
            Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy…) when you sign in.
          </p>
        </div>
        <span className={`tag shrink-0 ${enabled ? "tag-v" : "bg-bg-hover text-text-muted"}`}>{enabled ? "On" : "Off"}</span>
      </div>

      {notice && <p className="text-xs text-accent">{notice}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}

      {mode === "idle" &&
        (enabled ? (
          <Button variant="ghost" onClick={() => setMode("disabling")}>
            Turn off
          </Button>
        ) : (
          <Button onClick={begin} disabled={pending}>
            {pending ? "Starting…" : "Set up"}
          </Button>
        ))}

      {mode !== "idle" && (
        <form onSubmit={submit} className="space-y-3">
          {mode === "enrolling" && enrollment && (
            <div className="space-y-2">
              <p className="text-sm text-text">1. Scan this with your authenticator app.</p>
              {/* Supabase returns the QR code as an SVG data URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollment.qrCode} alt="QR code for your authenticator app" className="h-44 w-44 rounded border border-border bg-white p-2" />
              <p className="text-xs text-text-muted">
                Can&apos;t scan? Enter this key instead:{" "}
                <code className="select-all break-all rounded bg-bg-hover px-1 text-text">{enrollment.secret}</code>
              </p>
              <p className="text-sm text-text">2. Enter the 6-digit code it shows.</p>
            </div>
          )}
          {mode === "disabling" && <p className="text-sm text-text">Enter a current code from your authenticator app to turn 2FA off.</p>}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="input w-40 text-center text-lg tracking-[0.3em] tabular-nums"
          />
          <div className="flex gap-2">
            <Button type="submit" variant={mode === "disabling" ? "danger" : "primary"} disabled={pending || code.length !== 6}>
              {pending ? "Checking…" : mode === "enrolling" ? "Turn on" : "Turn off 2FA"}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
