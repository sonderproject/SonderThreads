"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { reportClientError } from "@/lib/actions/report-error";
import { isStaleAppError, reloadOnceForUpdate } from "@/lib/stale-app";

export default function AppError({
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

  if (reloading) return <p className="mx-auto max-w-lg py-16 text-sm text-text-muted">Updating to the latest version…</p>;
  return (
    <div className="mx-auto max-w-lg py-16">
      <Card className="p-6">
        <p className="mb-2 eyebrow text-danger">Something went wrong</p>
        <p className="mb-4 text-sm text-text-muted">
          {stale
            ? "Surfdesk was updated while this page was open. Reload the page to get the latest version."
            : "This page hit a problem. It's been reported, and trying again usually works."}
        </p>
        <Button onClick={() => (stale ? window.location.reload() : reset())}>{stale ? "Reload" : "Try again"}</Button>
      </Card>
    </div>
  );
}
