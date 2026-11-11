"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeSeats, previewSeatChange, type SeatPreview } from "@/lib/actions/billing";
import { MAX_SELF_SERVE_SEATS, MIN_ORG_SEATS, calculateMonthlyPriceCents, formatCents } from "@/lib/pricing";

/**
 * Admin: add or remove seats. Always previews the exact charge or credit
 * (from Stripe) before anything changes; the server re-checks everything.
 */
export function SeatManager({ purchased, inUse }: { purchased: number; inUse: number }) {
  const router = useRouter();
  const min = Math.max(MIN_ORG_SEATS, inUse);
  const [seats, setSeats] = useState(purchased);
  const [preview, setPreview] = useState<SeatPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valid = Number.isInteger(seats) && seats >= min && seats <= MAX_SELF_SERVE_SEATS;

  function change(n: number) {
    setSeats(n);
    setPreview(null);
    setError(null);
    setDone(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-border bg-bg-raised">
          <button type="button" onClick={() => change(Math.max(min, seats - 1))} className="h-10 w-10 rounded-full text-lg hover:bg-bg-hover" aria-label="One seat fewer">
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            aria-label="Seats"
            min={min}
            max={MAX_SELF_SERVE_SEATS}
            value={Number.isFinite(seats) ? seats : ""}
            onChange={(e) => change(Number.parseInt(e.target.value, 10))}
            className="w-16 bg-transparent text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" onClick={() => change(Math.min(MAX_SELF_SERVE_SEATS, seats + 1))} className="h-10 w-10 rounded-full text-lg hover:bg-bg-hover" aria-label="One seat more">
            +
          </button>
        </div>
        <span className="text-sm text-text-muted">
          {valid ? `${formatCents(calculateMonthlyPriceCents("organization", seats))} / month` : `At least ${min} seats`}
        </span>
      </div>

      {seats !== purchased && valid && !preview && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await previewSeatChange(seats);
              if (r.ok) setPreview(r.data);
              else setError(r.error);
            })
          }
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover disabled:opacity-60"
        >
          {pending ? "Checking…" : "Preview change"}
        </button>
      )}

      {preview && (
        <div className="space-y-3 rounded-2xl border border-border p-4 text-sm">
          <p className="text-text">
            {purchased} → {preview.seats} seats: {formatCents(preview.currentMonthlyCents)} → <strong>{formatCents(preview.newMonthlyCents)}</strong> a month.
          </p>
          <p className="text-text-muted">
            {preview.trialing
              ? "You're in your free trial, so nothing is charged today. The new amount starts when the trial ends."
              : preview.dueNowCents > 0
                ? `${formatCents(preview.dueNowCents)} is charged now for the rest of this billing month.`
                : preview.creditCents > 0
                  ? `${formatCents(preview.creditCents)} is credited to your next bill for the rest of this month.`
                  : "No charge today."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await changeSeats(preview.seats);
                  if (r.ok) {
                    setDone(`Done. You now have ${r.data.seats} seats.`);
                    setPreview(null);
                    router.refresh();
                  } else setError(r.error);
                })
              }
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-60"
            >
              {pending ? "Updating…" : "Confirm change"}
            </button>
            <button type="button" onClick={() => change(purchased)} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-bg-hover">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="flag text-sm">{error}</p>}
      {done && <p className="text-sm text-accent">{done}</p>}
    </div>
  );
}
