import type { Metadata } from "next";
import { PublicFormView } from "@/components/forms/PublicFormView";
import { publicForm, recordView, startStamp } from "@/lib/forms-intake";

export const metadata: Metadata = { title: "Form", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const CLOSED: Record<string, { title: string; body: string }> = {
  paused: { title: "Not taking answers right now", body: "This form is paused. Please check back later." },
  closed: { title: "This form is closed", body: "It's no longer taking answers." },
  full: { title: "This form is full", body: "It has reached the number of answers it can take." },
  maintenance: { title: "Back in a few minutes", body: "We're making a quick update. Please try again shortly." },
};

/** A public smart form (no sign-in). Shows nothing but the form. */
export default async function PublicFormPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const form = await publicForm(code);
  if (form && !form.closed) await recordView(form.id);
  const closed = form?.closed ? CLOSED[form.closed] : null;

  return (
    <div className="min-h-screen bg-bg px-4 py-10 text-text">
      <main className="mx-auto max-w-xl space-y-6">
        {!form ? (
          <div className="card space-y-2 p-6 text-center">
            <h1 className="page-title">Link not active</h1>
            <p className="text-sm text-text-muted">This form link isn&apos;t working. Ask whoever sent it for a new one.</p>
          </div>
        ) : closed ? (
          <div className="card space-y-2 p-6 text-center">
            {form.from && <p className="eyebrow text-text-faint">{form.from}</p>}
            <h1 className="page-title">{closed.title}</h1>
            <p className="text-sm text-text-muted">{closed.body}</p>
          </div>
        ) : (
          <PublicFormView
            code={form.code}
            name={form.name}
            description={form.description}
            from={form.from}
            fields={form.fields}
            stamp={startStamp(form.id)}
          />
        )}
        <p className="text-center text-xs text-text-faint">
          Powered by{" "}
          <a href="/" className="hover:text-text">
            Surfdesk
          </a>
        </p>
      </main>
    </div>
  );
}
