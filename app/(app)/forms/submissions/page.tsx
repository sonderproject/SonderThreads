import Link from "next/link";
import { listForms, listSubmissions, formScope } from "@/lib/forms";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/forms-shared";
import { shortDate } from "@/lib/team";
import { getTimeZone } from "@/lib/timezone";

export const metadata = { title: "Form responses" };

const STATUS = Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s.value, s]));

/** Every form response this person may see, newest first, with filters. */
export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; status?: string; q?: string; from?: string; to?: string; saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status === "open" || SUBMISSION_STATUSES.some((s) => s.value === sp.status) ? (sp.status as SubmissionStatus | "open") : undefined;
  const filters = { formId: sp.form || undefined, status, q: sp.q || undefined, from: sp.from || undefined, to: sp.to || undefined };
  const [rows, forms, scope, tz] = await Promise.all([listSubmissions(filters), listForms(), formScope(), getTimeZone()]);
  const filtered = Boolean(sp.form || status || sp.q || sp.from || sp.to);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link href="/forms" className="text-sm text-text-muted hover:text-text">
          ← Forms
        </Link>
        <h1 className="page-title">Responses</h1>
        <p className="text-sm text-text-muted">
          {scope.canManage ? "Every response to your forms." : "Responses assigned to you."} Approve to add someone, or link them to a profile you already have.
        </p>
      </div>
      {sp.saved === "deleted" && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">Response deleted. Its answers were erased.</p>}
      {sp.error === "gone" && <p className="flag rounded-xl p-3 text-sm">That response no longer exists.</p>}

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto_auto_auto]" role="search">
        <label className="space-y-1 text-sm">
          <span className="text-text-muted">Search answers</span>
          <input name="q" defaultValue={sp.q ?? ""} maxLength={80} placeholder="Name, email, anything typed" className="input" />
        </label>
        <label className="hidden space-y-1 text-sm sm:block">
          <span className="text-text-muted">Form</span>
          <select name="form" defaultValue={sp.form ?? ""} className="input">
            <option value="">All forms</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text-muted">Status</span>
          <select name="status" defaultValue={status ?? ""} className="input">
            <option value="">Any status</option>
            <option value="open">To review</option>
            {SUBMISSION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="hidden space-y-1 text-sm sm:block">
          <span className="text-text-muted">From</span>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="input tabular-nums" />
        </label>
        <label className="hidden space-y-1 text-sm sm:block">
          <span className="text-text-muted">To</span>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="input tabular-nums" />
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">Filter</button>
          {filtered && (
            <Link href="/forms/submissions" className="px-2 py-2 text-sm text-text-muted hover:text-text">
              Clear
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
          {filtered ? "No responses match these filters." : "No responses yet. Share a form to start collecting them."}
        </p>
      ) : (
        <ul className="card divide-y divide-border-subtle">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/forms/submissions/${r.id}`} className={`flex items-center gap-3 p-4 hover:bg-bg-hover ${r.status === "needs_review" || r.status === "new" ? "flag-attention" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">{r.personName ?? r.name ?? "Anonymous response"}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {r.formName}
                    {r.contact ? ` · ${r.contact}` : ""}
                    {r.assigneeName ? ` · ${r.assigneeName}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                  {r.duplicates > 0 && !r.personId && <span className="tag tag-u">Duplicate?</span>}
                  <span className={`tag ${STATUS[r.status]?.tone ?? ""}`}>{STATUS[r.status]?.label}</span>
                </span>
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-text-faint">{shortDate(r.createdAt, tz)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
