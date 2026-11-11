"use client";

import { useState } from "react";
import {
  MAX_SELF_SERVE_SEATS,
  ORG_INCLUDED_SEATS,
  SMALL_TEAM_MAX_SEATS,
  calculateMonthlyPriceCents,
  formatCents,
  orgTier,
  perSeatCents,
} from "@/lib/pricing";

/**
 * Seat count → monthly price, live. Display only: checkout and seat changes
 * recompute the price on the server (lib/pricing.ts + the verified Stripe price).
 * With `name`, it also submits the seat count as a form field.
 */
export function SeatCalculator({ min = 2, initial = 5, name }: { min?: number; initial?: number; name?: string }) {
  const [raw, setRaw] = useState(String(Math.max(min, initial)));
  const parsed = Number.parseInt(raw, 10);
  const seats = Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), MAX_SELF_SERVE_SEATS) : min;
  const total = calculateMonthlyPriceCents("organization", seats);
  const tier = orgTier(seats);
  const saved = perSeatCents(seats) - total;
  const step = (d: number) => setRaw(String(Math.min(Math.max(seats + d, min), MAX_SELF_SERVE_SEATS)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={name ?? "seat-calc"} className="text-sm text-text-muted">
          Team size
        </label>
        <div className="flex items-center rounded-full border border-border bg-bg-raised">
          <button type="button" onClick={() => step(-1)} className="h-10 w-10 rounded-full text-lg text-text hover:bg-bg-hover" aria-label="One seat fewer">
            −
          </button>
          <input
            id={name ?? "seat-calc"}
            name={name}
            type="number"
            inputMode="numeric"
            min={min}
            max={MAX_SELF_SERVE_SEATS}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => setRaw(String(seats))}
            className="w-16 bg-transparent text-center text-base tabular-nums text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" onClick={() => step(1)} className="h-10 w-10 rounded-full text-lg text-text hover:bg-bg-hover" aria-label="One seat more">
            +
          </button>
        </div>
        <span className="text-sm text-text-muted">{seats === 1 ? "seat" : "seats"}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
        <span className="font-display text-4xl font-light tabular-nums text-text">{formatCents(total)}</span>
        <span className="text-sm text-text-muted">/ month</span>
        <span className={`tag ${tier === "small_team" ? "tag-n" : "tag-v"}`}>{tier === "small_team" ? "Small Team" : "Organization"}</span>
      </div>
      <p className="text-xs text-text-muted">
        {tier === "small_team"
          ? `$19 × ${seats} seats. At ${SMALL_TEAM_MAX_SEATS + 1} seats the $349 Organization rate applies automatically.`
          : seats <= ORG_INCLUDED_SEATS
            ? `$349 Organization rate applied automatically${saved > 0 ? `: you save ${formatCents(saved)} vs. $19 a seat` : ""}. Includes ${ORG_INCLUDED_SEATS} seats.`
            : `$349 for the first ${ORG_INCLUDED_SEATS} seats + $15 × ${seats - ORG_INCLUDED_SEATS} more. You save ${formatCents(saved)} vs. $19 a seat.`}
      </p>
      {parsed > MAX_SELF_SERVE_SEATS && (
        <p className="text-xs text-text-muted">Over {MAX_SELF_SERVE_SEATS} seats? Talk to us about Enterprise.</p>
      )}
    </div>
  );
}
