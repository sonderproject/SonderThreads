"use client";

import { useState } from "react";
import type { DraftService } from "@/lib/setup";

/**
 * Set-up: tap suggested services on or off (with an optional price each for
 * businesses), and type up to three of your own. Plain form fields: "svc",
 * "price:<name>", "custom", "custom_price".
 */
export function ServicePicker({
  suggestions,
  withPrices,
  chosen,
}: {
  suggestions: string[];
  withPrices: boolean;
  chosen: DraftService[];
}) {
  const chosenBy = new Map(chosen.map((s) => [s.name.toLowerCase(), s]));
  const [on, setOn] = useState<Set<string>>(() => new Set(suggestions.filter((s) => chosenBy.has(s.toLowerCase()))));
  const customs = chosen.filter((s) => !suggestions.some((x) => x.toLowerCase() === s.name.toLowerCase()));
  const customRows = [0, 1, 2].map((i) => customs[i] ?? { name: "", price: null });

  const toggle = (name: string) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((name) => {
          const active = on.has(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active ? "border-accent bg-accent text-bg" : "border-border text-text hover:bg-bg-hover"
              }`}
            >
              {active ? "✓ " : "+ "}
              {name}
            </button>
          );
        })}
      </div>

      {[...on].map((name) => (
        <input key={`svc-${name}`} type="hidden" name="svc" value={name} />
      ))}

      {withPrices && on.size > 0 && (
        <div className="card space-y-2 p-4">
          <p className="text-xs text-text-muted">Prices (optional)</p>
          {[...on].map((name) => (
            <label key={`price-${name}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text">{name}</span>
              <span className="flex items-center gap-1">
                <span className="text-text-muted">$</span>
                <input
                  name={`price:${name}`}
                  inputMode="decimal"
                  defaultValue={chosenBy.get(name.toLowerCase())?.price ?? ""}
                  placeholder="0.00"
                  className="input w-24 tabular-nums"
                />
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-text-muted">Add your own</p>
        {customRows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input name="custom" defaultValue={row.name} maxLength={80} placeholder={`Service ${i + 1}`} className="input flex-1" />
            {withPrices ? (
              <input
                name="custom_price"
                inputMode="decimal"
                defaultValue={row.price ?? ""}
                placeholder="$ price"
                className="input w-24 tabular-nums"
              />
            ) : (
              <input type="hidden" name="custom_price" value="" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
