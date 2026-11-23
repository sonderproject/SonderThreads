import Link from "next/link";
import { notFound } from "next/navigation";
import { assignableMembers, formScope, getSubmission } from "@/lib/forms";
import { SUBMISSION_STATUSES } from "@/lib/forms-shared";
import { approveSubmission, assignSubmission, deleteSubmission, linkSubmission, setSubmissionStatus } from "@/lib/actions/forms";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { getTimeZone } from "@/lib/timezone";

export const metadata = { title: "Form response" };

const STATUS = Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s.value, s]));
const SAVED: Record<string, string> = {
  approved: "Approved. The new profile was added.",
  linked: "Added as a note on the existing profile. Nothing on it was changed.",
  rejected: "Marked as rejected. It stays in the list.",
  processed: "Marked as processed.",
  needs_review: "Moved back to review.",
  new: "Moved back to new.",
  assigned: "Assignment saved.",
};
const ERRORS: Record<string, string> = {
  name: "Add a first name to create the profile.",
  match: "That profile couldn't be found.",
  done: "This response is already attached to a profile.",
};
const btn = "rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover";
const primary = "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim";

export default async function SubmissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [x, scope, tz] = await Promise.all([getSubmission(id), formScope(), getTimeZone()]);
  if (!x) notFound();
  const members = scope.canManage ? await assignableMembers() : [];
  const open = !x.personId && x.status !== "rejected";
  const [first, ...rest] = (x.name ?? "").split(" ");
  const when = new Date(x.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

  const status = (s: string, label: string) => (
    <form action={setSubmissionStatus}>
      <input type="hidden" name="id" value={x.id} />
      <input type="hidden" name="status" value={s} />
      <button className={btn}>{label}</button>
    </form>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link href="/forms/submissions" className="text-sm text-text-muted hover:text-text">
          ← Responses
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">{x.personName ?? x.name ?? "Response"}</h1>
          <span className={`tag ${STATUS[x.status]?.tone ?? ""}`}>{STATUS[x.status]?.label}</span>
        </div>
        <p className="text-sm text-text-muted">
          <Link href={`/forms/${x.formId}`} className="hover:text-text hover:underline">
            {x.formName}
          </Link>{" "}
          · {when}
          {x.reviewedBy ? ` · handled by ${x.reviewedBy}` : ""}
        </p>
      </div>
      {sp.saved && SAVED[sp.saved] && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">{SAVED[sp.saved]}</p>}
      {sp.error && ERRORS[sp.error] && <p className="flag rounded-xl p-3 text-sm">{ERRORS[sp.error]}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card p-5" aria-labelledby="answers">
          <h2 id="answers" className="section-label mb-3">
            Answers
          </h2>
          <dl className="divide-y divide-border-subtle">
            {x.answers.map((a) => (
              <div key={a.id} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                <dt className="text-sm text-text-muted">{a.label}</dt>
                <dd className="whitespace-pre-line break-words text-sm text-text">{a.text || <span className="text-text-faint">No answer</span>}</dd>
              </div>
            ))}
          </dl>
        </section>

        <aside className="space-y-4">
          {x.personId && (
            <div className="card space-y-2 p-4">
              <p className="section-label">Profile</p>
              <Link href={`/people/${x.personId}`} className="block font-medium text-accent hover:underline">
                {x.personName ?? "Open profile"} →
              </Link>
            </div>
          )}

          {open && x.possibleMatches.length > 0 && (
            <div className="card flag-attention space-y-3 p-4">
              <p className="section-label">May already be here</p>
              <p className="text-xs text-text-muted">Same email, phone or name. Linking adds the answers as a note and changes nothing else.</p>
              <ul className="space-y-2">
                {x.possibleMatches.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle p-2.5">
                    <span className="min-w-0">
                      <Link href={`/people/${p.id}`} className="block truncate text-sm font-medium text-text hover:underline">
                        {p.name}
                      </Link>
                      <span className="block truncate text-xs text-text-faint">{p.email ?? p.phone ?? ""}</span>
                    </span>
                    <form action={linkSubmission}>
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="person_id" value={p.id} />
                      <button className={btn}>Link</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {open && (
            <form action={approveSubmission} className="card space-y-3 p-4">
              <input type="hidden" name="id" value={x.id} />
              <p className="section-label">Add as a new profile</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm">
                  <span className="text-text-muted">First name</span>
                  <input name="first_name" defaultValue={first || ""} maxLength={100} required className="input" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-text-muted">Last name</span>
                  <input name="last_name" defaultValue={rest.join(" ")} maxLength={100} className="input" />
                </label>
              </div>
              <p className="text-xs text-text-faint">Mapped answers fill the profile; the rest go in an intake note.</p>
              <button className={`${primary} w-full`}>{x.possibleMatches.length ? "Add anyway" : "Approve and add"}</button>
            </form>
          )}

          <div className="card space-y-3 p-4">
            <p className="section-label">Status</p>
            <div className="flex flex-wrap gap-2">
              {x.status !== "processed" && status("processed", "Mark processed")}
              {x.status !== "rejected" && !x.personId && status("rejected", "Reject")}
              {(x.status === "rejected" || x.status === "processed") && !x.personId && status("needs_review", "Back to review")}
            </div>
          </div>

          {scope.canManage && members.length > 0 && (
            <form action={assignSubmission} className="card space-y-2 p-4">
              <input type="hidden" name="id" value={x.id} />
              <label className="block space-y-1 text-sm">
                <span className="section-label">Assigned to</span>
                <select name="user_id" defaultValue={x.assignedTo ?? ""} className="input">
                  <option value="">Admins and Managers</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className={btn}>Save</button>
            </form>
          )}

          {scope.canManage && (
            <form action={deleteSubmission} className="px-1">
              <input type="hidden" name="id" value={x.id} />
              <ConfirmSubmit message="Delete this response? Its answers are erased for good. A profile already added stays." className="text-sm text-urgent hover:underline">
                Delete response
              </ConfirmSubmit>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
