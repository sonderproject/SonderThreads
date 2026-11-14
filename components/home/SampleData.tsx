"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadSampleData, removeSampleData } from "@/lib/actions/sample";
import { useTerms } from "@/components/TermsProvider";

/**
 * Empty account: "Try it with sample clients". With sample data in:
 * a banner that removes it all in one click.
 */
export function SampleData({ mode }: { mode: "offer" | "loaded" }) {
  const terms = useTerms();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: typeof loadSampleData) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

  if (mode === "loaded") {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-text">
          <span className="tag mr-2">Sample</span>
          You&apos;re looking at sample people and {terms.checkInsLower}. Remove them before you add your own.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Remove all sample people and their " + terms.checkInsLower + "? Your own data isn't touched.")) run(removeSampleData);
          }}
          className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover disabled:opacity-60"
        >
          {pending ? "Removing…" : "Remove sample data"}
        </button>
        {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="card space-y-2 p-4">
      <p className="text-sm font-semibold text-text">Want to see it in action first?</p>
      <p className="text-sm text-text-muted">
        Add 12 sample people with a month of {terms.checkInsLower}, so you can explore People and your {terms.impact} report before adding real
        data. One click removes it all.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(loadSampleData)}
        className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-60"
      >
        {pending ? "Adding…" : "Try it with sample people"}
      </button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
