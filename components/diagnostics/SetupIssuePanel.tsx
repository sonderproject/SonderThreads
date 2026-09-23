import type { Diagnostic } from "@/lib/actions/diagnostics";

export function SetupIssuePanel({ diagnostic }: { diagnostic: Extract<Diagnostic, { ok: false }> }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="rounded border border-border bg-bg-raised p-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-danger">
          Setup issue: {diagnostic.reason}
        </p>
        <p className="mb-4 text-sm text-text-muted whitespace-pre-wrap">{diagnostic.detail}</p>
        <p className="text-xs text-text-faint">
          Checklist: in Vercel, Storage tab → Create Database → Postgres (this injects POSTGRES_URL
          automatically) → run db/schema.sql against it once (Vercel&apos;s Query tab, or psql).
        </p>
      </div>
    </div>
  );
}
