import type { Metadata } from "next";
import { CommandDemo } from "@/components/landing/CommandDemo";
import { CalendarIcon, MicIcon, PeopleIcon, TasksIcon } from "@/components/ui/icons";
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

const AUDIENCES = ["Freelancers", "Business owners", "Coaches", "Realtors", "Consultants", "Case managers", "Students", "Parents", "Teams"];

const TEAMS = [
  "A Team view of each person's clients, today's check-ins and services, and their calendar.",
  "Managers can read client records and leave comments. Never anyone's tasks or personal notes.",
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
  ["Team dashboard: each person's clients, check-ins and services today", false],
  ["Activity log of who changed what", false],
  ["Impact reports (PDF) with your logo", false],
  ["Referral link and referral log", false],
  ["Front-desk check-in kiosk", false],
  ["Client reassignment and manager comments", false],
  ["Onboarding help and data import", false],
];

const TEAM_SIGNUP = "/signup?next=%2Forganization%2Fnew";
/** "Get started now": sign up, then land on Billing with "Skip the trial: 30% off your first month" up front. */
const OFFER_SIGNUP = "/signup?next=%2Fbilling%3Foffer%3Dskip";
const TEAM_OFFER_SIGNUP = "/signup?next=%2Forganization%2Fnew%3Foffer%3Dskip";
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
  /** Skip the trial, 30% off the first month. */
  offerHref?: string;
  featured?: boolean;
}[] = [
  {
    name: "Individual",
    who: "For one person with clients, projects or a busy life to keep straight.",
    price: "$9",
    unit: "/ month",
    fine: "7-day free trial, no card needed. Cancel any time.",
    features: ["Your own private workspace", "Tasks, to-dos, notes and lists", "Clients and check-ins with full history", "Voice notes, smart command box, reminders"],
    cta: "Start your free trial",
    href: "/signup",
    offerHref: OFFER_SIGNUP,
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
    offerHref: TEAM_OFFER_SIGNUP,
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
    offerHref: TEAM_OFFER_SIGNUP,
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

/** One feature on the landing page: colored icon, title, one line, and a small live preview. */
function Feature({
  title,
  body,
  icon,
  className = "",
  children,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`card group flex flex-col gap-4 p-5 transition-transform duration-200 motion-safe:hover:-translate-y-1 sm:p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          {icon}
        </span>
        <div className="space-y-1">
          <h3 className="font-display text-lg font-normal leading-snug">{title}</h3>
          <p className="text-sm leading-relaxed text-text-muted">{body}</p>
        </div>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

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
      <p className="w-full text-sm text-text-muted">
        Ready now?{" "}
        <Link href={OFFER_SIGNUP} className="font-medium text-accent hover:underline">
          Get started today with 30% off your first month →
        </Link>
      </p>
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
          <div className="grid gap-4 lg:grid-cols-3">
            {/* 1. Say it once: the live command bar */}
            <Feature
              className="lg:col-span-2"
              icon={<MicIcon className="h-5 w-5" />}
              title="Just say it. Strynd files it."
              body="Type or speak one sentence. It becomes a task, a note, a reminder or a sale, linked to the right person. No forms."
            >
              <CommandDemo />
            </Feature>

            {/* 2. Tasks */}
            <Feature
              icon={<TasksIcon className="h-5 w-5" />}
              title="Nothing slips"
              body="Due dates, repeats and reminders. Notes that mention a to-do suggest the task for you."
            >
              <ul className="space-y-1.5 text-sm" aria-hidden>
                <li className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded border border-border" />
                  <span className="flex-1 truncate">Call the landlord</span>
                  <span className="tag tag-e !ml-0">Today 2pm</span>
                </li>
                <li className="flex items-center gap-2 text-text-muted">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-accent text-[10px] text-bg">✓</span>
                  <span className="flex-1 truncate line-through">Send the lease forms</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded border border-border" />
                  <span className="flex-1 truncate">Follow up with Ana</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-urgent" style={{ background: "var(--urgent-soft)" }}>
                    Overdue
                  </span>
                </li>
              </ul>
            </Feature>

            {/* 3. People */}
            <Feature
              icon={<PeopleIcon className="h-5 w-5" />}
              title="Everyone's story, in one place"
              body="A profile for every client or customer: notes, visits, tasks and follow-ups on one timeline."
            >
              <div className="space-y-2" aria-hidden>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
                  >
                    AO
                  </span>
                  <span className="text-sm font-medium">Ana Ortiz</span>
                </div>
                <ul className="space-y-1 border-l-2 border-border pl-3 text-xs text-text-muted">
                  <li>Today · Haircut, $45</li>
                  <li>Nov 3 · Note: moving in December</li>
                  <li>Oct 20 · Follow-up done</li>
                </ul>
              </div>
            </Feature>

            {/* 4. Calendar */}
            <Feature
              icon={<CalendarIcon className="h-5 w-5" />}
              title="Your whole week, one calendar"
              body="Tasks and birthdays, plus your Google, Apple or Outlook calendar. Calendly bookings too."
            >
              <div className="space-y-2" aria-hidden>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-muted">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <div key={i} className={`rounded-md py-1 ${i === 3 ? "bg-accent text-bg" : "bg-bg"}`}>
                      {d}
                      <div className="mt-0.5 flex justify-center gap-0.5">
                        {i % 2 === 0 && <span className={`h-1 w-1 rounded-full ${i === 3 ? "bg-bg" : "bg-accent"}`} />}
                        {i !== 6 && i % 3 === 0 && <span className={`h-1 w-1 rounded-full ${i === 3 ? "bg-bg" : "bg-text-muted"}`} />}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["Google", "Apple", "Outlook", "Calendly"].map((c) => (
                    <span key={c} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </Feature>

            {/* 6. Private */}
            <Feature
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              }
              title="Private, and always yours"
              body="Your data is never sold. Two-step sign-in, auto sign-out, and database-level privacy. Export everything, any time."
            >
              <div className="flex flex-wrap gap-2" aria-hidden>
                {["Two-step sign-in", "Auto sign-out", "Never sold", "Export any time", "Works on any phone"].map((c) => (
                  <span key={c} className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-medium text-text">
                    ✓ {c}
                  </span>
                ))}
              </div>
            </Feature>
            {/* 5. Insights */}
            <Feature
              className="lg:col-span-3"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                  <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                </svg>
              }
              title="Insights for smarter decisions"
              body="Personal and business insights: your best services, busiest days and hours, and what's growing or slipping. Decide with real numbers, then share them as a polished PDF report in one click."
            >
              <div className="grid gap-4 sm:grid-cols-2 sm:items-end" aria-hidden>
                <div className="space-y-2">
                <div className="flex h-20 items-end gap-1.5">
                  {[35, 55, 40, 70, 60, 95, 50].map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-t"
                      style={{ height: `${h}%`, background: i === 5 ? "var(--accent)" : "color-mix(in srgb, var(--accent) 30%, transparent)" }}
                    />
                  ))}
                </div>
                <p className="flex flex-wrap gap-x-3 text-xs text-text-muted">
                  <span>
                    Busiest: <strong className="text-text">Sat 10am</strong>
                  </span>
                  <span>
                    Haircuts <strong className="text-accent">↑ 20%</strong>
                  </span>
                </p>
                </div>
                <div className="space-y-2 rounded-2xl border border-border bg-bg p-4">
                <p className="text-sm font-medium text-text">Monthly report · November</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <path d="M14 3v6h6M12 12v6M9 15l3 3 3-3" />
                    </svg>
                    PDF report
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted">Excel</span>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted">CSV</span>
                </div>
                <p className="text-[11px] text-text-muted">PDF reports with your logo on team plans; Excel and CSV on every plan.</p>
                </div>
              </div>
            </Feature>

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
                {p.offerHref && (
                  <a href={p.offerHref} className="-mt-1 text-center text-sm font-medium text-accent hover:underline">
                    Or get started now: 30% off your first month
                  </a>
                )}
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
