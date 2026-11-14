import Link from "next/link";
import { finishWelcome } from "@/lib/actions/billing";

type Step = { title: string; body: string; href: string };

const INDIVIDUAL_STEPS: Step[] = [
  { title: "Add your first person", body: "A client, or anyone you want to keep track of.", href: "/people" },
  { title: "Log a meeting", body: "Record a visit or a call. It shows up in your Insights.", href: "/check-ins" },
  { title: "Turn on reminders", body: "So follow-ups find you, not the other way around.", href: "/settings#notifications" },
];
const ORG_STEPS: Step[] = [
  { title: "Invite your staff", body: "Billing updates on its own as people join or leave.", href: "/organization" },
  { title: "Bring clients in", body: "Move existing clients into the organization in one step.", href: "/organization/clients" },
  { title: "Turn on reminders", body: "So follow-ups find your team, not the other way around.", href: "/settings#notifications" },
];

/**
 * Full-screen thank-you right after Stripe Checkout, shown once per
 * subscription. It closes through finishWelcome, which records that it was seen.
 */
export function SubscribedWelcome({
  firstName,
  org,
  trialEnds,
  price,
}: {
  firstName: string | null;
  org: string | null;
  trialEnds: string | null;
  price: string | null;
}) {
  const steps = org ? ORG_STEPS : INDIVIDUAL_STEPS;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label="Welcome to Surfdesk">
      <div className="sheet-in mx-auto flex min-h-full max-w-lg flex-col justify-center gap-8 px-4 py-12">
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <p className="eyebrow text-text-faint">Welcome to Surfdesk</p>
          <h1 className="page-title">
            {org ? `${org} is all set.` : firstName ? `You're in, ${firstName}.` : "You're in."}
          </h1>
          <p className="text-text-muted">
            Thank you for {org ? "bringing your team to" : "choosing"} Surfdesk. We built it for people who carry a lot for
            others, and we&apos;re glad you&apos;re here.
          </p>
        </div>

        {trialEnds && (
          <div className="card space-y-1 p-4 text-center">
            <p className="text-sm text-text">
              Your free trial runs until <strong>{trialEnds}</strong>.
            </p>
            <p className="text-sm text-text-muted">
              {price ? `Your first charge of ${price} is that day.` : "Your first charge is that day."} Cancel any time in
              Settings.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="section-label">Where to start</p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className="card flex items-start gap-3 p-4 hover:bg-bg-hover">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-text-muted">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text">{s.title}</span>
                    <span className="block text-xs text-text-muted">{s.body}</span>
                  </span>
                  <span className="text-sm text-accent" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <form action={finishWelcome}>
          <button type="submit" className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-bg hover:bg-accent-dim">
            Let&apos;s go
          </button>
        </form>
      </div>
    </div>
  );
}
