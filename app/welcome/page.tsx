import type { Metadata } from "next";
import Link from "next/link";
import { SITE_DESCRIPTION } from "@/lib/site";
import { LegalLinks } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/settings-options";

// Signed-out visitors to "/" are shown this page (middleware rewrites to it),
// so "/" is the canonical address search engines should index.
export const metadata: Metadata = {
  title: "Sonder Threads: clients, tasks and notes in one calm place",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sonder Threads",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "Sonder Threads",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Sonder Threads", description: SITE_DESCRIPTION },
};

const FEATURES = [
  {
    title: "Clients & check-ins",
    body: "Profiles, demographics, check-ins and a full history for everyone you work with.",
  },
  { title: "Tasks & reminders", body: "Follow-ups that repeat, remind you on time, and never fall through the cracks." },
  { title: "Notes & voice", body: "Type it or say it. Notes land on the right person, ready to search later." },
  { title: "Lists & groups", body: "Rosters, groups and checklists you can share and export." },
  { title: "Private by default", body: "Two-factor sign-in, auto-lock, and database-level privacy on every record." },
  { title: "Yours to take", body: "Export everything as spreadsheets or a full backup, any time." },
];

const AGENCY = [
  "A Team view of every caseload: clients, follow-ups and overdue tasks.",
  "Supervisors read client records and leave comments. Never anyone's personal notes.",
  "Invite staff, reassign clients, and keep an audit log of who did what.",
  "HMIS stays your system of record. Threads is the system of work that makes entry a quick batch job.",
];

/** Studio-style section marker: number, hairline, wide-tracked label. */
function Marker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.25em] text-text-muted">
      <span className="tabular-nums text-accent">{n}</span>
      <span className="h-px w-10" style={{ background: "color-mix(in srgb, var(--accent) 45%, transparent)" }} aria-hidden />
      {children}
    </p>
  );
}

function Cta({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <Link
        href="/signup"
        className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg shadow-sm ring-1 ring-inset ring-white/15 transition-colors hover:bg-accent-dim"
      >
        Start your free trial
      </Link>
      <Link
        href="/login"
        className="rounded-full border border-border bg-bg-raised px-6 py-3 text-sm font-semibold text-text transition-colors hover:bg-bg-hover"
      >
        Sign in
      </Link>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="glass pt-safe sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Sonder Threads">
            <span className="brand-mark h-7 w-[37px]" aria-hidden />
            <span className="font-display text-sm font-light uppercase tracking-[0.25em] text-text">Threads</span>
            <span className="hidden h-4 w-px sm:block" style={{ background: "color-mix(in srgb, var(--accent) 50%, transparent)" }} aria-hidden />
            <span className="hidden text-[11px] uppercase tracking-[0.25em] text-text-muted sm:block">by Sonder Project</span>
          </Link>
          <nav className="flex items-center gap-2">
            <a href="#pricing" className="hidden rounded-full px-4 py-2 text-sm text-text-muted transition-colors hover:text-text sm:inline-block">
              Pricing
            </a>
            <Link href="/login" className="rounded-full px-4 py-2 text-sm text-text-muted transition-colors hover:text-text">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim"
            >
              Get started
            </Link>
          </nav>
        </div>
        <div className="nav-glow" aria-hidden />
        <div className="nav-glow-line" aria-hidden />
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-8">
        <section className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="space-y-6">
            <Marker n="01">Client tracker &amp; personal organizer</Marker>
            <h1 className="font-display text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-6xl">
              The daily tool for the people you serve.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">
              Clients, tasks, notes and check-ins in one calm place. Type it or say it, and Threads files it where it
              belongs.
            </p>
            <Cta />
            <p className="text-xs text-text-muted">7-day free trial · Works on any phone or computer</p>
          </div>

          <div className="card space-y-3 p-5" aria-hidden>
            <p className="section-label">Today</p>
            {[
              { name: "Maria Lopez", note: "Housing intake follow-up", tag: "Due today", tone: "tag-e" },
              { name: "James Carter", note: "Benefits renewal", tag: "Overdue", tone: "tag-u" },
              { name: "Ana Ruiz", note: "Checked in · food pantry", tag: "New", tone: "tag-n" },
            ].map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-text-muted">{r.note}</p>
                </div>
                <span className={`tag ${r.tone}`}>{r.tag}</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-text-muted">“remind me to call Maria Thursday” → task · Thu</p>
          </div>
        </section>

        <section className="space-y-8 border-t border-border py-16">
          <Marker n="02">What it does</Marker>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card space-y-2 p-5">
                <h2 className="font-display text-lg font-normal">{f.title}</h2>
                <p className="text-sm leading-relaxed text-text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-10 border-t border-border py-16 lg:grid-cols-2">
          <div className="space-y-5">
            <Marker n="03">For agencies</Marker>
            <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
              Built for case management teams.
            </h2>
            <p className="text-text-muted">
              Give your staff the tool they&apos;ll actually use every day, and give supervisors a clear view of every
              caseload, while each person&apos;s own tasks and notes stay private.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Sonder Threads for our agency")}`}
              className="inline-block rounded-full border border-border bg-bg-raised px-6 py-3 text-sm font-semibold transition-colors hover:bg-bg-hover"
            >
              Talk to us about your team
            </a>
          </div>
          <ul className="card divide-y divide-border-subtle">
            {AGENCY.map((line) => (
              <li key={line} className="flex gap-3 p-4 text-sm leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="scroll-mt-20 space-y-8 border-t border-border py-16">
          <Marker n="04">Pricing</Marker>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card flex flex-col gap-4 p-6">
              <div>
                <h2 className="font-display text-2xl font-light">Individual</h2>
                <p className="mt-1 text-sm text-text-muted">For anyone with clients, projects or a busy life to keep straight: entrepreneurs, freelancers, coaches, case managers and more.</p>
              </div>
              <p className="font-display text-5xl font-light tabular-nums">
                $5<span className="ml-1 font-sans text-base text-text-muted">/ month</span>
              </p>
              <p className="-mt-2 text-xs text-text-muted">7-day free trial. Cancel any time.</p>
              <ul className="flex-1 space-y-2 text-sm">
                {["Clients, check-ins, notes, tasks and lists", "Voice notes and smart command box", "Impact dashboard and PDF reports", "Export everything, any time"].map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="rounded-full border border-border bg-bg-raised px-6 py-3 text-center text-sm font-semibold hover:bg-bg-hover">
                Start your free trial
              </Link>
            </div>
            <div className="card flex flex-col gap-4 border-accent p-6" style={{ borderColor: "var(--accent)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-light">Organization</h2>
                  <p className="mt-1 text-sm text-text-muted">For agencies and teams that work together.</p>
                </div>
                <span className="tag tag-v">Most agencies</span>
              </div>
              <p className="font-display text-5xl font-light tabular-nums">
                $15<span className="ml-1 font-sans text-base text-text-muted">per staff member / month</span>
              </p>
              <p className="-mt-2 text-xs text-text-muted">
                Or Team: $249 / month for up to 20 staff, $10 for each one after. 30-day free trial.
              </p>
              <ul className="flex-1 space-y-2 text-sm">
                {[
                  "Everything in Individual",
                  "Team view of every caseload, with supervisor comments",
                  "Organization-wide Impact reports, with your logo",
                  "Front-desk check-in kiosk",
                  "Roles, invites, client reassignment and an audit log",
                  "Personal notes stay private, enforced by the database",
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Sonder Threads for our agency")}`}
                className="rounded-full bg-accent px-6 py-3 text-center text-sm font-semibold text-bg hover:bg-accent-dim"
              >
                Talk to us about your team
              </a>
            </div>
          </div>
        </section>

        <section className="space-y-6 border-t border-border py-16">
          <Marker n="05">Put it on your phone</Marker>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card space-y-1 p-5">
              <h2 className="font-display text-lg font-normal">iPhone</h2>
              <p className="text-sm text-text-muted">
                Open sonderthreads.com in Safari, tap <strong className="text-text">Share</strong>, then{" "}
                <strong className="text-text">Add to Home Screen</strong>.
              </p>
            </div>
            <div className="card space-y-1 p-5">
              <h2 className="font-display text-lg font-normal">Android</h2>
              <p className="text-sm text-text-muted">
                Open sonderthreads.com in Chrome, tap the <strong className="text-text">⋮</strong> menu, then{" "}
                <strong className="text-text">Add to Home screen</strong> (or <strong className="text-text">Install app</strong>).
              </p>
            </div>
          </div>
          <Cta className="pt-4" />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="pb-safe-5 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-8">
          <p className="text-xs text-text-muted">© {new Date().getFullYear()} Sonder Project</p>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
