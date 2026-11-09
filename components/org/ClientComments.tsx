import { addClientComment } from "@/lib/actions/org";

export type ClientComment = { id: string; body: string; created_at: string; author: string | null };

/**
 * Supervisor comments on a client. On the Team view it has a box to add
 * one; on the case manager's own client page it's read-only.
 */
export function ClientComments({
  personId,
  comments,
  canComment,
  formatDate,
  error,
}: {
  personId: string;
  comments: ClientComment[];
  canComment: boolean;
  formatDate: (iso: string) => string;
  error?: boolean;
}) {
  if (!canComment && comments.length === 0) return null;
  return (
    <section id="comments" className="scroll-mt-20 space-y-3">
      <h2 className="eyebrow text-text-faint">Supervisor comments ({comments.length})</h2>
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="card space-y-1 p-3">
              <p className="whitespace-pre-wrap text-sm text-text">{c.body}</p>
              <p className="text-xs text-text-faint">
                {c.author ?? "Former staff"} · {formatDate(c.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {canComment && (
        <form action={addClientComment} className="card space-y-2 p-3">
          <input type="hidden" name="person_id" value={personId} />
          <textarea
            name="body"
            required
            maxLength={5000}
            rows={3}
            placeholder="Leave a comment for the case manager…"
            className="input"
          />
          {error && <p className="text-xs text-danger">Write a comment first.</p>}
          <button type="submit" className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
            Add comment
          </button>
          <p className="text-xs text-text-muted">The case manager is notified. Only your organization can see comments.</p>
        </form>
      )}
    </section>
  );
}
