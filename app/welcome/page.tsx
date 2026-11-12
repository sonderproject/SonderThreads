import type { Metadata } from "next";
import Link from "next/link";
import { SITE_DESCRIPTION } from "@/lib/site";
import { LegalLinks } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/settings-options";
import { SeatCalculator } from "@/components/billing/SeatCalculator";

// Signed-out visitors to "/" are shown this page (middleware rewrites to it),
// so "/" is the canonical address search engines should index.
export const metadata: Metadata = {
  title: "Strynd: tasks, to-dos, notes and clients in one place",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Strynd",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "Strynd",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Strynd", description: SITE_DESCRIPTION },
};

const FEATURES = [
  {
    title: "Tasks & to-dos",
    body: "Due dates, repeating tasks and reminders that actually reach you. Your day, sorted, and nothing slips.",
  },
  {
    title: "Clients & people",
    body: "A profile and full history for everyone you work with: notes, check-ins, tasks and follow-ups, all in one place.",
  },
  {
    title: "Say it once",
    body: "Type “remind me to call Sarah Friday” or just say it. Strynd makes the task, sets the reminder and links the person.",
  },
  { title: "Notes & voice notes", body: "Capture anything in seconds. Notes land on the right person or project, ready to search later." },
  { title: "Lists & groups", body: "Checklists, shopping lists, rosters and groups you can share and export." },
  { title: "Private and yours", body: "Two-factor sign-in, auto-lock and record-level privacy. Export everything, any time." },
];

const AUDIENCES = ["Freelancers", "Business owners", "Coaches", "Realtors", "Consultants", "Case managers", "Students", "Parents", "Teams"];

const TEAMS = [
  "A Team view of everyone's clients, follow-ups and overdue tasks.",
  "Managers can read client records and leave comments. Never anyone's personal notes.",
  "Invite your team, reassign clients, and see an activity log of who did what.",
  "Impact reports with your logo, ready for your boss, your board or your funders.",
];

/** [feature, included in Individual]. Organization includes everything. */
const COMPARE: [string, boolean][] = [
  ["Clients, tasks, notes, lists and check-ins", true],
  ["Voice notes, smart command box and reminders", true],
  ["Personal stats dashboard", true],
  ["Export everything (Excel, full backup)", true],
  ["One shared client list the whole team works from", false],
  ["Roles for admins, managers and members", false],
  ["Team dashboard: everyone's clients, follow-ups, overdue", false],
  ["Activity log of who changed what", false],
  ["Impact reports (PDF) with your logo", false],
  ["Referral link and referral log", false],
  ["Front-desk check-in kiosk", false],
  ["Client reassignment and manager comments", false],
  ["Onboarding help and data import", false],
];

const TEAM_SIGNUP = "/signup?next=%2Forganization%2Fnew";
const SALES = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Strynd Enterprise")}`;

const PLANS: {
  name: string;
  who: string;
  price: string;
  unit?: string;
  fine: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
}[] = [
  {
    name: "Individual",
    who: "For one person with clients, projects or a busy life to keep straight.",
    price: "$9",
    unit: "/ month",
    fine: "7-day free trial. Cancel any time.",
    features: ["Your own private workspace", "Tasks, to-dos, notes and lists", "Clients and check-ins with full history", "Voice notes, smart command box, reminders"],
    cta: "Start your free trial",
    href: "/signup",
  },
  {
    name: "Small Team",
    who: "For teams of 2–18 people.",
    price: "$19",
    unit: "/ user / month",
    fine: "e.g. 5 people: $95 / month. 14-day free trial.",
    features: ["Everything in Individual, for everyone", "Shared team workspace and client list", "Invite and manage team members", "Roles and access controls", "One bill for the whole team"],
    cta: "Start a free team trial",
    href: TEAM_SIGNUP,
  },
  {
    name: "Organization",
    who: "For organizations of 19 or more.",
    price: "$349",
    unit: "/ month",
    fine: "20 seats included. Additional seats $15 / user / month.",
    features: ["Everything in Small Team", "20 seats included", "Extra seats just $15 each", "Team dashboard, activity log, Impact reports", "Admin permissions and centralized billing"],
    cta: "Start a free team trial",
    href: TEAM_SIGNUP,
    featured: true,
  },
  {
    name: "Enterprise",
    who: "For large organizations with special needs.",
    price: "Custom",
    fine: "Tailored pricing and terms.",
    features: ["Everything in Organization", "Guided onboarding and data import", "Integrations and custom setup", "Priority support"],
    cta: "Contact sales",
    href: SALES,
  },
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
          <Link href="/" className="flex items-center gap-3" aria-label="Strynd">
            <span className="brand-mark h-7 w-[37px]" aria-hidden />
            <span className="font-display text-sm font-light uppercase tracking-[0.25em] text-text">Strynd</span>
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
            <Marker n="01">Tasks · To-dos · Notes · Clients</Marker>
            <h1 className="font-display text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-6xl">
              Everything you need to stay organized. One app.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">
              Your tasks, to-do lists, notes and the people you work with, in one calm place. Type it or say it once, and
              Strynd files it, reminds you and keeps it all together. No more juggling five apps.
            </p>
            <Cta />
            <p className="text-xs text-text-muted">7-day free trial · Works on any phone or computer</p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-text-muted">Made for</span>
              {AUDIENCES.map((a) => (
                <span key={a} className="rounded-full border border-border px-3 py-1 text-xs text-text-muted">
                  {a}
                </span>
              ))}
            </div>
          </div>

          <div className="card space-y-3 p-5" aria-hidden>
            <p className="section-label">Today</p>
            {[
              { name: "Sarah Kim", note: "Send the proposal", tag: "Due today", tone: "tag-e" },
              { name: "Grocery run", note: "Milk, eggs, coffee, birthday card", tag: "To-do", tone: "tag-v" },
              { name: "Marcus Cole", note: "Check in after his first week", tag: "Overdue", tone: "tag-u" },
            ].map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-text-muted">{r.note}</p>
                </div>
                <span className={`tag ${r.tone}`}>{r.tag}</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-text-muted">“remind me to call Sarah Thursday” → task · Thu</p>
          </div>
        </section>

        <section className="space-y-8 border-t border-border py-16">
          <Marker n="02">One app instead of five</Marker>
          <h2 className="max-w-2xl font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
            Your to-do app, notes app, reminders and client list. Finally in one place.
          </h2>
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
            <Marker n="03">For teams</Marker>
            <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
              Even better together.
            </h2>
            <p className="text-text-muted">
              Offices, agencies, nonprofits and small businesses: give everyone the tool they&apos;ll actually use every
              day, and give managers a clear view of every client, while each person&apos;s own tasks and notes stay
              private.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={TEAM_SIGNUP}
                className="inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim"
              >
                Start a 14-day free team trial
              </Link>
              <a
                href="#pricing"
                className="inline-block rounded-full border border-border bg-bg-raised px-6 py-3 text-sm font-semibold transition-colors hover:bg-bg-hover"
              >
                See team pricing
              </a>
            </div>
          </div>
          <ul className="card divide-y divide-border-subtle">
            {TEAMS.map((line) => (
              <li key={line} className="flex gap-3 p-4 text-sm leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="scroll-mt-20 space-y-8 border-t border-border py-16">
          <Marker n="04">Pricing</Marker>
          <h2 className="max-w-2xl font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
            Simple pricing that gets cheaper as your team grows.
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className="card flex flex-col gap-4 p-6"
                style={p.featured ? { borderColor: "var(--accent)" } : undefined}
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-2xl font-light">{p.name}</h3>
                    {p.featured && <span className="tag tag-v whitespace-nowrap">Best value</span>}
                  </div>
                  <p className="text-sm text-text-muted">{p.who}</p>
                </div>
                <p className="font-display text-4xl font-light tabular-nums">
                  {p.price}
                  {p.unit && <span className="ml-1 font-sans text-sm text-text-muted">{p.unit}</span>}
                </p>
                <p className="-mt-2 text-xs text-text-muted">{p.fine}</p>
                <ul className="flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={p.href}
                  className={
                    p.featured
                      ? "rounded-full bg-accent px-6 py-3 text-center text-sm font-semibold text-bg hover:bg-accent-dim"
                      : "rounded-full border border-border bg-bg-raised px-6 py-3 text-center text-sm font-semibold hover:bg-bg-hover"
                  }
                >
                  {p.cta}
                </a>
              </div>
            ))}
          </div>

          <div className="card grid gap-6 p-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div className="space-y-2">
              <p className="section-label">Team price calculator</p>
              <h3 className="font-display text-2xl font-light">What will my team pay?</h3>
              <p className="text-sm text-text-muted">
                $19 a seat up to 18 people. From 19 seats, the $349 Organization rate (20 seats included) kicks in
                automatically because it&apos;s cheaper, and each seat after 20 is just $15. You never have to pick the right
                plan; you always get the lower price.
              </p>
            </div>
            <SeatCalculator initial={5} />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="eyebrow border-b border-border text-left text-text-faint">
                  <th className="px-4 py-3 font-semibold">Compare plans</th>
                  <th className="px-3 py-3 text-center font-semibold">Individual</th>
                  <th className="px-4 py-3 text-center font-semibold text-accent">Teams</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {COMPARE.map(([label, solo]) => (
                  <tr key={label}>
                    <td className="px-4 py-2.5">{label}</td>
                    <td className="px-3 py-2.5 text-center text-text-muted">{solo ? "✓" : "—"}</td>
                    <td className="px-4 py-2.5 text-center text-accent">✓</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-text-muted">
            Teams = Small Team and Organization. Teams start with a 14-day free trial ($0 today; card required, one trial per card). Add or remove seats any
            time; changes are prorated.
          </p>
        </section>

        <section className="space-y-6 border-t border-border py-16">
          <Marker n="05">Put it on your phone</Marker>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card space-y-1 p-5">
              <h2 className="font-display text-lg font-normal">iPhone</h2>
              <p className="text-sm text-text-muted">
                Open strynd.com in Safari, tap <strong className="text-text">Share</strong>, then{" "}
                <strong className="text-text">Add to Home Screen</strong>.
              </p>
            </div>
            <div className="card space-y-1 p-5">
              <h2 className="font-display text-lg font-normal">Android</h2>
              <p className="text-sm text-text-muted">
                Open strynd.com in Chrome, tap the <strong className="text-text">⋮</strong> menu, then{" "}
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
