import type { SupabaseDiagnostic } from "@/lib/actions/diagnostics";

export function SetupIssuePanel({ diagnostic }: { diagnostic: Extract<SupabaseDiagnostic, { ok: false }> }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="rounded border border-border bg-bg-raised p-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-danger">
          Setup issue: {diagnostic.reason}
        </p>
        <p className="mb-4 text-sm text-text-muted whitespace-pre-wrap">{diagnostic.detail}</p>
        <p className="text-xs text-text-faint">
          Checklist: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY set correctly →
          Authentication → Providers → Anonymous Sign-ins enabled → supabase/migrations/0001_init.sql
          run in the SQL editor.
        </p>
      </div>
    </div>
  );
}
