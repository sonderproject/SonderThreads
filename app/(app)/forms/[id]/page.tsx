import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { FormBuilder } from "@/components/forms/FormBuilder";
import { CopyText } from "@/components/org/CopyText";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { assignableMembers, formScope, formStats, getForm } from "@/lib/forms";
import { listCustomFields } from "@/lib/custom-fields";
import { deleteForm, duplicateForm, newFormLink, setFormStatus } from "@/lib/actions/forms";
import { appUrl } from "@/lib/email";

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "" },
  published: { label: "Live", tone: "tag-v" },
  paused: { label: "Paused", tone: "tag-e" },
  archived: { label: "Archived", tone: "" },
};
const SAVED: Record<string, string> = {
  published: "Your form is live. Share the link or QR code below.",
  paused: "Paused. The link shows that the form isn't taking answers.",
  archived: "Archived. The link no longer works; responses are kept.",
  draft: "Back to draft.",
  link: "New link made. The old link and QR code no longer work.",
};
const btn = "rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover";
const primary = "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim";

export const metadata = { title: "Form" };

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [form, scope] = await Promise.all([getForm(id), formScope()]);
  if (!form) notFound();
  const tab = sp.tab === "share" || sp.tab === "results" ? sp.tab : "build";
  const url = `${appUrl()}/f/${form.code}`;
  const live = form.status === "published";

  const [customFields, members, stats, qr] = await Promise.all([
    tab === "build" ? listCustomFields() : Promise.resolve([]),
    tab === "build" && scope.canManage ? assignableMembers() : Promise.resolve([]),
    tab === "results" ? formStats(form.id) : Promise.resolve(null),
    tab === "share" ? QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b1220", light: "#ffffff" } }) : Promise.resolve(""),
  ]);

  const statusForm = (status: string, label: string, cls = btn) => (
    <form action={setFormStatus}>
      <input type="hidden" name="id" value={form.id} />
      <input type="hidden" name="status" value={status} />
      <button className={cls}>{label}</button>
    </form>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href="/forms" className="text-sm text-text-muted hover:text-text">
          ← Forms
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="page-title truncate">{form.name}</h1>
            <span className={`tag ${STATUS[form.status].tone}`}>{STATUS[form.status].label}</span>
          </div>
          {scope.canManage && (
            <div className="flex flex-wrap gap-2">
              {form.status === "draft" && statusForm("published", "Publish", primary)}
              {form.status === "paused" && statusForm("published", "Resume", primary)}
              {live && statusForm("paused", "Pause")}
              {form.status === "archived" && statusForm("draft", "Restore")}
            </div>
          )}
        </div>
      </div>

      {sp.saved && SAVED[sp.saved] && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">{SAVED[sp.saved]}</p>}
      {sp.error === "has-submissions" && <p className="flag rounded-xl p-3 text-sm">This form has responses, so it can be archived but not deleted.</p>}

      <nav className="inline-flex rounded-full border border-border bg-bg-raised p-0.5 text-sm" aria-label="Form sections">
        {(
          [
            ["build", scope.canManage ? "Build" : "Questions"],
            ["share", "Share"],
            ["results", "Results"],
          ] as const
        ).map(([k, label]) => (
          <Link
            key={k}
            href={`/forms/${form.id}?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 ${tab === k ? "bg-accent text-bg" : "text-text-muted hover:text-text"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "build" && (
        <FormBuilder
          formId={form.id}
          initial={{ name: form.name, description: form.description, fields: form.fields, settings: form.settings }}
          customFields={customFields.map((c) => ({ id: c.id, label: c.label, kind: c.kind }))}
          members={members}
          canEdit={scope.canManage}
        />
      )}

      {tab === "share" && (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="card space-y-4 p-5">
            {!live && (
              <p className="flag rounded-xl p-3 text-sm">
                {form.status === "draft" ? "Publish the form so the link starts working." : form.status === "paused" ? "The form is paused: the link says it isn't taking answers." : "Archived: the link doesn't work."}
              </p>
            )}
            <div className="space-y-1.5">
              <p className="section-label">Form link</p>
              <CopyText value={url} ariaLabel="Form link" />
              <p className="text-xs text-text-faint">Anyone with the link can fill the form. They never see your other forms or anything in your account.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={url} target="_blank" rel="noopener" className={btn}>
                Open the form
              </a>
              {scope.canManage && (
                <form action={newFormLink}>
                  <input type="hidden" name="id" value={form.id} />
                  <ConfirmSubmit message="Make a new link? The old link and QR code stop working right away." className={btn}>
                    New link
                  </ConfirmSubmit>
                </form>
              )}
              {scope.canManage && (
                <form action={duplicateForm}>
                  <input type="hidden" name="id" value={form.id} />
                  <button className={btn}>Duplicate form</button>
                </form>
              )}
            </div>
            {scope.canManage && (
              <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                {form.status !== "archived" && statusForm("archived", "Archive form")}
                <form action={deleteForm}>
                  <input type="hidden" name="id" value={form.id} />
                  <ConfirmSubmit message="Delete this form? This can't be undone." className={`${btn} text-urgent`}>
                    Delete
                  </ConfirmSubmit>
                </form>
              </div>
            )}
          </div>
          <div className="card space-y-3 p-5 text-center">
            <p className="section-label">QR code</p>
            <div className="mx-auto w-48 rounded-xl bg-white p-2 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR code for the form link" dangerouslySetInnerHTML={{ __html: qr }} />
            <a href={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`} download={`${form.name.replace(/[^\w -]/g, "").trim() || "form"} QR.svg`} className={`${btn} inline-block`}>
              Download
            </a>
            <p className="text-xs text-text-faint">Print it on a flyer or front desk sign.</p>
          </div>
        </div>
      )}

      {tab === "results" && stats && <Results id={form.id} stats={stats} />}
    </div>
  );
}

function Results({ id, stats }: { id: string; stats: NonNullable<Awaited<ReturnType<typeof formStats>>> }) {
  const max = Math.max(1, ...stats.daily.map((d) => Math.max(d.views, d.submissions)));
  const tiles: [string, string][] = [
    ["Views", String(stats.views)],
    ["Responses", String(stats.submissions)],
    ["Completion", stats.completionRate === null ? "—" : `${stats.completionRate}%`],
    ["Profiles added", String(stats.profilesCreated)],
  ];
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-4">
            <dt className="text-xs text-text-muted">{k}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="section-label">Last 30 days</p>
          <p className="flex gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-3)" }} aria-hidden /> Views
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-1)" }} aria-hidden /> Responses
            </span>
          </p>
        </div>
        <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`${stats.views} views and ${stats.submissions} responses in total`}>
          {stats.daily.map((d) => (
            <div key={d.day} className="flex h-full flex-1 items-end gap-px" title={`${d.day}: ${d.views} views, ${d.submissions} responses`}>
              <div className="flex-1 rounded-t-sm" style={{ height: `${(d.views / max) * 100}%`, background: "var(--chart-3)", minHeight: d.views ? 2 : 0 }} />
              <div className="flex-1 rounded-t-sm" style={{ height: `${(d.submissions / max) * 100}%`, background: "var(--chart-1)", minHeight: d.submissions ? 2 : 0 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="card space-y-3 p-5">
        <p className="section-label">Where responses stand</p>
        <ul className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {(
            [
              ["new", "New"],
              ["needs_review", "Needs review"],
              ["approved", "Approved"],
              ["processed", "Processed"],
              ["rejected", "Rejected"],
            ] as const
          ).map(([k, label]) => (
            <li key={k}>
              <Link href={`/forms/submissions?form=${id}&status=${k}`} className="block rounded-xl border border-border-subtle p-3 hover:bg-bg-hover">
                <span className="block text-xs text-text-muted">{label}</span>
                <span className="text-lg font-semibold tabular-nums">{stats.byStatus[k]}</span>
              </Link>
            </li>
          ))}
        </ul>
        {stats.medianSeconds !== null && (
          <p className="text-xs text-text-faint">Typical time to fill: {stats.medianSeconds < 90 ? `${stats.medianSeconds} seconds` : `${Math.round(stats.medianSeconds / 60)} minutes`}.</p>
        )}
      </div>
    </div>
  );
}
