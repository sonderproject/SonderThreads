"use client";

import { useEffect, useState } from "react";
import { reportClientError } from "@/lib/actions/report-error";
import { isStaleAppError, reloadOnceForUpdate } from "@/lib/stale-app";

/** Error screen for pages outside the signed-in app (sign-in, sign-up, booking, referral…). */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleAppError(error.message);
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    console.error(error);
    // An open page from before an update: a fresh load fixes it, so do that instead of showing an error.
    if (stale && reloadOnceForUpdate()) {
      setReloading(true);
      return;
    }
    void reportClientError(error.message, window.location.pathname, error.digest).catch(() => {});
  }, [error, stale]);

  if (reloading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-sm text-text-muted">Updating to the latest version…</div>;
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-lg rounded border border-border bg-bg-raised p-6">
        <p className="mb-2 eyebrow text-danger">Something went wrong</p>
        <p className="mb-4 text-sm text-text-muted">
          {stale
            ? "Surfdesk was updated while this page was open. Reload the page to get the latest version."
            : "This page hit a problem. It's been reported, and trying again usually works."}
        </p>
        <button
          onClick={() => (stale ? window.location.reload() : reset())}
          className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent-dim"
        >
          {stale ? "Reload" : "Try again"}
        </button>
      </div>
    </div>
  );
}
