"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-lg rounded border border-border bg-bg-raised p-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-danger">
          Something went wrong
        </p>
        <p className="mb-4 text-sm text-text-muted whitespace-pre-wrap">{error.message}</p>
        <p className="mb-4 text-xs text-text-faint">
          Most often this means Supabase isn&apos;t fully set up yet: check that
          NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set, Anonymous
          Sign-ins are enabled (Authentication → Providers), and the migration in
          supabase/migrations/0001_init.sql has been run.
        </p>
        <button
          onClick={reset}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
