import Link from "next/link";
import { getMembership } from "@/lib/org";
import { formScope, listForms } from "@/lib/forms";
import { FORM_TEMPLATES } from "@/lib/form-templates";
import { createForm } from "@/lib/actions/forms";
import { shortDate } from "@/lib/team";
import { getTimeZone } from "@/lib/timezone";

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "" },
  published: { label: "Live", tone: "tag-v" },
  paused: { label: "Paused", tone: "tag-e" },
  archived: { label: "Archived", tone: "" },
};
const ERRORS: Record<string, string> = {
  limit: "You've reached the limit of 50 forms. Archive or delete one to make room.",
  gone: "That form no longer exists.",
  manage: "Only Admins and Managers can create or change forms.",
};

export const metadata = { title: "Forms" };

/** Smart forms: every form in the account, plus starting a new one from a template. */
export default async function FormsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; start?: string }> }) {
  const sp = await searchParams;
  const [scope, forms, m, tz] = await Promise.all([formScope(), listForms(), getMembership(), getTimeZone()]);
  const audience = m?.active ? (m.orgKind === "business" ? "business" : "nonprofit") : "individual";
  const toReview = forms.reduce((n, f) => n + f.toReview, 0);
  const templates = [...FORM_TEMPLATES].sort((a, b) => Number(b.audience === audience) - Number(a.audience === audience));
  const mine = templates.filter((t) => t.audience === audience);
  const more = templates.filter((t) => t.audience !== audience);
  const showPicker = scope.canManage && (forms.length === 0 || sp.start === "1");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="eyebrow text-text-faint">Smart forms</p>
          <h1 className="page-title">Forms</h1>
          <p className="text-sm text-text-muted">Share a link or QR code. Answers come back here, and new people can be added for you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/automations" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover">
            Automate responses
          </Link>
          <Link href="/forms/submissions" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover">
            Responses{toReview > 0 && <span className="tag tag-e ml-2">{toReview} to review</span>}
          </Link>
          {scope.canManage && !showPicker && (
            <Link href="/forms?start=1" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
              New form
            </Link>
          )}
        </div>
      </div>

      {sp.error && ERRORS[sp.error] && <p className="flag rounded-xl p-3 text-sm">{ERRORS[sp.error]}</p>}
      {sp.saved === "deleted" && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">Form deleted.</p>}

      {showPicker && (
        <section className="space-y-3" aria-labelledby="start">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="start" className="section-label">
              Start a form
            </h2>
            {forms.length > 0 && (
              <Link href="/forms" className="text-sm text-text-muted hover:text-text">
                Cancel
              </Link>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <form action={createForm}>
              <button className="card flex h-full w-full flex-col items-start gap-1 border-dashed p-4 text-left transition-colors hover:bg-bg-hover">
                <span className="text-sm font-semibold text-text">Blank form</span>
                <span className="text-xs text-text-muted">Start with name and email, add anything.</span>
              </button>
            </form>
            {mine.map((t) => (
              <TemplateCard key={t.key} t={t} />
            ))}
          </div>
          {more.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-text-muted hover:text-text">More templates ({more.length})</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {more.map((t) => (
                  <TemplateCard key={t.key} t={t} />
                ))}
              </div>
            </details>
          )}
          <p className="text-xs text-text-faint">
            Templates never ask for Social Security numbers, medical history or ID numbers. Add only what you need.
          </p>
        </section>
      )}

      {forms.length > 0 && (
        <section className="space-y-3" aria-labelledby="yours">
          <h2 id="yours" className="section-label">
            {m?.active ? "Your organization's forms" : "Your forms"}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {forms.map((f) => (
              <li key={f.id}>
                <Link href={`/forms/${f.id}`} className="card block space-y-3 p-4 transition-colors hover:bg-bg-hover">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-text">{f.name}</span>
                    <span className={`tag ${STATUS[f.status].tone}`}>{STATUS[f.status].label}</span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-text-faint">Responses</dt>
                      <dd className="text-base font-semibold tabular-nums text-text">{f.submissions}</dd>
                    </div>
                    <div>
                      <dt className="text-text-faint">To review</dt>
                      <dd className={`text-base font-semibold tabular-nums ${f.toReview ? "text-warn" : "text-text"}`}>{f.toReview}</dd>
                    </div>
                    <div>
                      <dt className="text-text-faint">Views</dt>
                      <dd className="text-base font-semibold tabular-nums text-text">{f.views}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-text-faint">
                    {f.fieldCount} fields · {f.lastAt ? `last response ${shortDate(f.lastAt, tz)}` : "no responses yet"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {forms.length === 0 && !scope.canManage && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No forms yet. An Admin or Manager can create one.
        </p>
      )}
    </div>
  );
}

function TemplateCard({ t }: { t: (typeof FORM_TEMPLATES)[number] }) {
  return (
    <form action={createForm}>
      <input type="hidden" name="template" value={t.key} />
      <button className="card flex h-full w-full flex-col items-start gap-1 p-4 text-left transition-colors hover:bg-bg-hover">
        <span className="text-sm font-semibold text-text">{t.name}</span>
        <span className="text-xs text-text-muted">{t.description}</span>
        <span className="mt-1 text-xs text-text-faint">
          {t.fields.length} fields ·{" "}
          {t.intake === "auto" ? "adds people automatically" : t.intake === "review" ? "you review each one" : "collects answers only"}
        </span>
      </button>
    </form>
  );
}
