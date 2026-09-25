import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { SearchResults } from "@/lib/actions/search";

export function SearchResultsPanel({
  query,
  results,
  onClose,
}: {
  query: string;
  results: SearchResults;
  onClose?: () => void;
}) {
  const total =
    results.people.length + results.notes.length + results.lists.length + results.tasks.length;

  return (
    <Card className="mt-3 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-xs text-text-muted">
          {total} result{total === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
        </p>
        {onClose && (
          <button onClick={onClose} className="text-xs text-text-faint hover:text-text">
            dismiss
          </button>
        )}
      </div>

      {total === 0 && <p className="text-sm text-text-faint">Nothing found.</p>}

      <div className="space-y-4">
        {results.people.length > 0 && (
          <ResultSection title="People">
            {results.people.map((c) => (
              <Link
                key={c.id}
                href={`/people/${c.id}`}
                className="block rounded px-2 py-1.5 hover:bg-bg-hover"
              >
                <p className="text-sm text-text">{c.display_name}</p>
                {c.current_status && <p className="text-xs text-text-muted">{c.current_status}</p>}
              </Link>
            ))}
          </ResultSection>
        )}

        {results.notes.length > 0 && (
          <ResultSection title="Notes">
            {results.notes.map((n) => (
              <Link
                key={n.id}
                href={n.person_id ? `/people/${n.person_id}` : "/notes"}
                className="block rounded px-2 py-1.5 hover:bg-bg-hover"
              >
                <p className="text-sm text-text">{n.content}</p>
              </Link>
            ))}
          </ResultSection>
        )}

        {results.lists.length > 0 && (
          <ResultSection title="Lists">
            {results.lists.map((l) => (
              <Link
                key={l.id}
                href={`/lists/${l.id}`}
                className="block rounded px-2 py-1.5 hover:bg-bg-hover"
              >
                <p className="text-sm text-text">{l.name}</p>
              </Link>
            ))}
          </ResultSection>
        )}

        {results.tasks.length > 0 && (
          <ResultSection title="Tasks">
            {results.tasks.map((t) => (
              <Link
                key={t.id}
                href="/tasks"
                className="block rounded px-2 py-1.5 hover:bg-bg-hover"
              >
                <p className="text-sm text-text">{t.title}</p>
              </Link>
            ))}
          </ResultSection>
        )}
      </div>
    </Card>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-text-faint">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
