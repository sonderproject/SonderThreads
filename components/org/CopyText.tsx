"use client";

import { useState } from "react";

/** A read-only value with a Copy button (falls back to selecting the text). */
export function CopyText({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="input min-w-0 flex-1 font-mono text-xs"
        aria-label="Referral link"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* the field is selectable as a fallback */
          }
        }}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim"
      >
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
