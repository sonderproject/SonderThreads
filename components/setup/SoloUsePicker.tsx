"use client";

import { useState } from "react";
import { ServicePicker } from "@/components/setup/ServicePicker";
import type { DraftService } from "@/lib/setup";

/** Individual set-up: personal / solo business / other; a business also picks its services and prices. */
export function SoloUsePicker({
  uses,
  services,
  initialUse,
  chosen,
}: {
  uses: { value: string; label: string; hint: string }[];
  services: string[];
  initialUse: string | null;
  chosen: DraftService[];
}) {
  const [use, setUse] = useState<string | null>(initialUse);
  return (
    <div className="space-y-5">
      <fieldset className="grid gap-3">
        <legend className="sr-only">What will you use Surfdesk for?</legend>
        {uses.map((u) => (
          <label
            key={u.value}
            className="card flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-bg-hover has-[:checked]:border-accent has-[:checked]:ring-1 has-[:checked]:ring-accent"
          >
            <input
              type="radio"
              name="use"
              value={u.value}
              required
              checked={use === u.value}
              onChange={() => setUse(u.value)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span className="space-y-1">
              <span className="block font-semibold text-text">{u.label}</span>
              <span className="block text-xs text-text-muted">{u.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {use === "business" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text">What do you offer? (optional)</p>
          <p className="text-xs text-text-muted">Log these in a tap when you see a client, and see your revenue in Insights.</p>
          <ServicePicker suggestions={services} withPrices chosen={chosen} />
        </div>
      )}
    </div>
  );
}
