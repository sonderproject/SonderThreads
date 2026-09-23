"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function AppError({
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
    <div className="mx-auto max-w-lg py-16">
      <Card className="p-6">
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
        <Button onClick={reset}>Try again</Button>
      </Card>
    </div>
  );
}
