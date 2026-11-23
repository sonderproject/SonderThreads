import type { Metadata } from "next";
import { CampaignLinks } from "@/components/landing/CampaignLinks";
import { CommandDemo } from "@/components/landing/CommandDemo";
import { AgencyPreviews } from "@/components/landing/AgencyPreviews";
import { CalendarIcon, MicIcon, PeopleIcon, TasksIcon } from "@/components/ui/icons";
import Link from "next/link";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { LegalLinks } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/settings-options";
import { SeatCalculator } from "@/components/billing/SeatCalculator";
import { ALL_SEO_PAGES } from "@/lib/seo-pages";
import { LANDING_LINKS } from "@/lib/landing";
import { MarketingAnalytics } from "@/components/marketing/landing/Track";

// Signed-out visitors to "/" are shown this page (middleware rewrites to it),
// so "/" is the canonical address search engines should index.
export const metadata: Metadata = {
  title: { absolute: "Surfdesk | Tasks, Notes, Clients & Teams in One App" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Surfdesk",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "Surfdesk",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Surfdesk", description: SITE_DESCRIPTION },
};

const AUDIENCES = ["Freelancers", "Business owners", "Coaches", "Realtors", "Consultants", "Case managers", "Students", "Parents", "Teams"];

const TEAMS = [
  "Team chat built in: channels for everyone, plus private group and direct messages. Tag a client or share a note right in the conversation. Private chats stay private, even from admins.",
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
  ["Team chat: channels, group chats and direct messages", false],
  ["Roles for admins, managers and members", false],
  ["Team dashboard: each person's clients, check-ins and services today", false],
  ["Activity log of who changed what", false],
  ["Impact reports (PDF) with your logo", false],
  ["Referral link and referral log", false],
  ["Front-desk check-in kiosk", false],
  ["Client reassignment and manager comments", false],
  ["Onboarding help and data import", false],
];

/** "Built around you": one card per audience, each linking to its landing page. */
const AUDIENCE_CARDS = [
  {
    eyebrow: "Individuals",
    title: "Less to remember. More room to live.",
    body: "Keep your tasks, reminders, notes, lists, and calendar organized without making organization another chore.",
    cta: "Explore for Individuals",
    href: "/individuals",
  },
  {
    eyebrow: "Businesses",
    title: "Better organization. Better business decisions.",
    body: "Manage customers, bookings, services, follow-ups, and your team. See how your business is performing, all from one place.",
    cta: "Explore for Business",
    href: "/business",
  },
  {
    eyebrow: "Nonprofits",
    title: "Your people, programs, and progress. Connected.",
    body: "Coordinate staff, manage participants, track services, and measure your organization's impact in one organized workspace.",
    cta: "Explore for Nonprofits",
    href: "/nonprofits",
  },
];

/** Every sign-up goes through a guided set-up (lib/setup.ts): organizations and individuals each have their own. */
const START = "/get-started";
const SOLO_SIGNUP = "/get-started/solo";
const TEAM_SIGNUP = "/get-started/org";
/** "Get started now": the same set-up, with "Skip the trial: 30% off your first month" up front at the end. */
const OFFER_SIGNUP = "/get-started/solo?offer=skip";
const TEAM_OFFER_SIGNUP = "/get-started/org?offer=skip";
/** "Your data" section. Accurate on purpose: we store data to run the app, so never say we don't keep it. */
const DATA_PROMISES = [
  { title: "Never sold", body: "We never sell your data or use it for ads. It's used only to run Surfdesk for you." },
  { title: "Encrypted", body: "Encrypted in transit and at rest, with two-step sign-in and automatic sign-out on shared computers." },
  { title: "Walled off", body: "Database-level access rules keep every account and organization separate. Staff see only what their role allows." },
  { title: "Yours to take or delete", body: "Export everything to Excel, CSV or a full backup any time. Delete your account and your data is deleted with it." },
];
const SALES = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Surfdesk Enterprise")}`;

const PLANS: {
  name: string;
  who: string;
  price: string;
  unit?: string;
  fine: string;
  /** Short savings callout shown under the fine print. */
  save?: string;
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
    href: SOLO_SIGNUP,
    offerHref: OFFER_SIGNUP,
  },
  {
    name: "Small Team",
    who: "For teams of 2–18 people.",
    price: "$19",
    unit: "/ user / month",
    fine: "e.g. 5 people: $95 / month. 14-day free trial.",
    features: ["Everything in Individual, for everyone", "Shared team workspace and client list", "Team chat: channels and direct messages", "Invite and manage team members", "Roles and access controls", "One bill for the whole team"],
    cta: "Start a free team trial",
    href: TEAM_SIGNUP,
    offerHref: TEAM_OFFER_SIGNUP,
  },
  {
    name: "Organization",
    who: "For organizations of 19 or more.",
    price: "$349",
    unit: "/ month",
    fine: "20 seats included: $17.45 a person. Every seat after 20 is just $15.",
    save: "Saves $852 a year at 30 people, $1,812 at 50",
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

function Cta({
  className = "",
  label = "Start your free trial",
  secondary = { href: "/login", label: "Sign in" },
}: {
  className?: string;
  label?: string;
  secondary?: { href: string; label: string };
}) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <Link
        href={START}
        className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg shadow-sm ring-1 ring-inset ring-white/15 transition-colors hover:bg-accent-dim"
      >
        {label}
      </Link>
      <Link
        href={secondary.href}
        className="rounded-full border border-border bg-bg-raised px-6 py-3 text-sm font-semibold text-text transition-colors hover:bg-bg-hover"
      >
        {secondary.label}
      </Link>
      <p className="w-full text-sm text-text-muted">7-day free trial · No card needed · Cancel any time</p>
      <p className="w-full text-sm text-text-muted">
        Ready now?{" "}
        <Link href={`${START}?offer=skip`} className="font-medium text-accent hover:underline">
          Get started today with 30% off your first month →
        </Link>
      </p>
    </div>
  );
}

/** Structured data for search engines: the app, its plans, and who makes it. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Surfdesk",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Productivity / CRM",
      operatingSystem: "Web, iOS, Android",
      image: `${SITE_URL}/opengraph-image.png`,
      publisher: { "@id": "https://www.sonderproject.co/#organization" },
      offers: PLANS.filter((p) => p.price.startsWith("$")).map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: p.price.replace("$", ""),
        priceCurrency: "USD",
        description: `${p.price} ${p.unit ?? ""}. ${p.fine}`.trim(),
        url: SITE_URL,
      })),
    },
    {
      "@type": "Organization",
      "@id": "https://www.sonderproject.co/#organization",
      name: "Sonder Project",
      url: "https://www.sonderproject.co/",
      sameAs: ["https://www.instagram.com/sonderproject.co/"],
    },
  ],
};

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <CampaignLinks />
      <MarketingAnalytics />
      <header className="glass pt-safe sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Surfdesk">
            <span className="brand-mark h-7 w-[37px]" aria-hidden />
            <span className="font-display text-sm font-light uppercase tracking-[0.25em] text-text">Surfdesk</span>
            <span className="hidden h-4 w-px sm:block" style={{ background: "color-mix(in srgb, var(--accent) 50%, transparent)" }} aria-hidden />
            <span className="hidden text-[11px] uppercase tracking-[0.25em] text-text-muted sm:block">by Sonder Project</span>
          </Link>
          <nav className="flex items-center gap-2">
            <a href="#pricing" className="hidden rounded-full px-4 py-2 text-sm text-text-muted transition-colors hover:text-text sm:inline-block">
              Pricing
            </a>
            <Link href="/login" className="whitespace-nowrap rounded-full px-4 py-2 text-sm text-text-muted transition-colors hover:text-text">
              Sign in
            </Link>
            <Link
              href={START}
              className="whitespace-nowrap rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim"
            >
              <span className="sm:hidden">Get started</span>
              <span className="hidden sm:inline">Get Started Free</span>
            </Link>
          </nav>
        </div>
        <div className="nav-glow" aria-hidden />
        <div className="nav-glow-line" aria-hidden />
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-8">
        <section className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="space-y-6">
            <Marker n="01">Tasks · Notes · Clients · Teams</Marker>
            <h1 className="font-display text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-6xl lg:text-[3.6rem]">
              <span className="whitespace-nowrap">Your day.</span> <span className="whitespace-nowrap">Your people.</span>{" "}
              <br className="hidden sm:block" />
              <span className="whitespace-nowrap">Your work.</span> <span className="block text-accent">All in one place.</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">
              Tasks, notes, reminders, calendars, clients, and teams. Everything connected in one simple workspace.
            </p>
            <p className="font-display text-lg font-normal text-text sm:text-xl">
              Just type it or say it. Surfdesk keeps it organized.
            </p>
            <Cta label="Get Started Free" secondary={{ href: "#in-action", label: "See Surfdesk in Action" }} />
            <p className="text-xs text-text-muted">Works on any phone or computer</p>
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

        <section className="space-y-6 border-t border-border py-16 sm:py-20">
          <Marker n="02">Why Surfdesk</Marker>
          <h2 className="max-w-3xl font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
            Life moves fast. <span className="text-accent">Keep everything together.</span>
          </h2>
          <div className="max-w-2xl space-y-4 text-base leading-relaxed text-text-muted sm:text-lg">
            <p>
              The things you need to remember. The people you need to follow up with. The work that needs to get done.
            </p>
            <p>
              Surfdesk brings it all together, so you can spend less time managing the details and more time moving
              forward.
            </p>
          </div>
        </section>

        <section id="in-action" className="scroll-mt-20 grid gap-10 border-t border-border py-16 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="space-y-5">
            <Marker n="03">Smart command box</Marker>
            <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
              Say it. Save it. <span className="text-accent">Done.</span>
            </h2>
            <p className="max-w-lg text-text-muted">
              Need to remember something? Add a task? Make a note about someone? Just type or speak naturally. Surfdesk
              helps put everything where it belongs.
            </p>
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                <MicIcon className="h-4 w-4" />
              </span>
              Type it, or tap the mic and say it.
            </p>
          </div>
          <div className="card p-5 sm:p-6">
            <CommandDemo />
          </div>
        </section>

        <section className="space-y-8 border-t border-border py-16">
          <Marker n="04">Everything in one place</Marker>
          <h2 className="max-w-2xl font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
            Your to-do app, notes app, reminders and client list. Finally in one place.
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Capture */}
            <Feature
              icon={<TasksIcon className="h-5 w-5" />}
              title="Capture anything"
              body="Tasks, notes, reminders, and ideas. Type it or say it, and keep everything organized."
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

            {/* 2. People */}
            <Feature
              icon={<PeopleIcon className="h-5 w-5" />}
              title="Keep your people close"
              body="Every client, conversation, visit, and follow-up connected in one place."
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

            {/* 3. Calendar */}
            <Feature
              icon={<CalendarIcon className="h-5 w-5" />}
              title="Stay ahead of your day"
              body="Appointments, deadlines, recurring tasks, and reminders. Know what's next without keeping everything in your head."
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

            {/* 4. Team (team plans only) */}
            <Feature
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
              title="Keep your team connected"
              body="Shared client records, assignments, team chat, and the information everyone needs to stay coordinated."
            >
              <div className="space-y-2" aria-hidden>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-text"># general</span>
                  <span className="tag tag-v">Team plans</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <p className="rounded-xl bg-bg px-3 py-2 text-text-muted">
                    <strong className="text-text">Dana:</strong> Can someone cover Ana Ortiz at 3?
                  </p>
                  <p className="rounded-xl bg-accent-soft px-3 py-2 text-text">
                    <strong>Leo:</strong> Got it, she&apos;s on my list.
                  </p>
                </div>
              </div>
            </Feature>

            {/* 5. Search */}
            <Feature
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              }
              title="Find what matters"
              body="Search your people, notes, tasks, and lists without digging through different apps."
            >
              <div className="space-y-2" aria-hidden>
                <div className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-text">
                  ana<span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-accent" />
                </div>
                <ul className="space-y-1 text-xs text-text-muted">
                  <li><span className="font-semibold text-text">Person</span> · Ana Ortiz</li>
                  <li><span className="font-semibold text-text">Note</span> · Ana is moving in December</li>
                  <li><span className="font-semibold text-text">Task</span> · Follow up with Ana</li>
                </ul>
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
              className="sm:col-span-2 lg:col-span-3"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                  <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                </svg>
              }
              title="See the bigger picture"
              body="Understand your progress, customer activity, revenue, and organizational impact with meaningful insights. Share them as a polished report in one click."
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

        <section className="space-y-8 border-t border-border py-16">
          <Marker n="05">Who it&apos;s for</Marker>
          <h2 className="max-w-2xl font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
            One workspace. <span className="text-accent">Built around you.</span>
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {AUDIENCE_CARDS.map((c) => (
              <div key={c.eyebrow} className="card flex flex-col gap-3 p-6 transition-transform duration-200 motion-safe:hover:-translate-y-1">
                <p className="section-label">{c.eyebrow}</p>
                <h3 className="font-display text-xl font-normal leading-snug">{c.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-text-muted">{c.body}</p>
                <Link href={c.href} className="text-sm font-semibold text-accent hover:underline">
                  {c.cta} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-10 border-t border-border py-16 lg:grid-cols-2">
          <div className="space-y-5">
            <Marker n="06">For teams and agencies</Marker>
            <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
              Even better together.
            </h2>
            <p className="text-text-muted">
              Offices, agencies, nonprofits and small businesses: give everyone the tool they&apos;ll actually use every
              day, keep everyone talking in one place, and give managers a clear view of every client, while each
              person&apos;s own tasks and notes stay private.
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
            <ul className="card divide-y divide-border-subtle">
              {TEAMS.map((line) => (
                <li key={line} className="flex gap-3 p-4 text-sm leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <AgencyPreviews />
        </section>

        <section className="space-y-8 border-t border-border py-16">
          <Marker n="07">Your data</Marker>
          <h2 className="max-w-2xl font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
            Your data is yours. Full stop.
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DATA_PROMISES.map((d) => (
              <div key={d.title} className="card space-y-1.5 p-5">
                <p className="font-semibold text-text">{d.title}</p>
                <p className="text-sm text-text-muted">{d.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 space-y-8 border-t border-border py-16">
          <Marker n="08">Pricing</Marker>
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
                {p.save && <p className="-mt-2 text-xs font-semibold text-accent">{p.save}</p>}
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

          {/* Why Organization is the better deal: the same app, a lower price per person as the team grows. */}
          <div className="card space-y-4 p-6">
            <div className="space-y-1">
              <p className="section-label">Why Organization is the better deal</p>
              <p className="text-sm text-text-muted">
                Same app, same features for everyone. The price per person drops as you grow: $19 on Small Team, $17.45 at 20 people, and every
                person after 20 is just $15.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="eyebrow border-b border-border text-left text-text-faint">
                    <th className="py-2 pr-3 font-semibold">Team size</th>
                    <th className="px-3 py-2 text-right font-semibold">At $19 a seat</th>
                    <th className="px-3 py-2 text-right font-semibold text-accent">Organization</th>
                    <th className="px-3 py-2 text-right font-semibold">Per person</th>
                    <th className="py-2 pl-3 text-right font-semibold">You save a year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {[
                    [20, 380, 349, "17.45", 372],
                    [30, 570, 499, "16.63", 852],
                    [50, 950, 799, "15.98", 1812],
                    [100, 1900, 1549, "15.49", 4212],
                  ].map(([size, flat, org, per, saved]) => (
                    <tr key={size}>
                      <td className="py-2 pr-3">{size} people</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-muted line-through">${flat.toLocaleString()}/mo</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-text">${org.toLocaleString()}/mo</td>
                      <td className="px-3 py-2 text-right tabular-nums">${per}</td>
                      <td className="py-2 pl-3 text-right font-semibold tabular-nums text-accent">${saved.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-faint">You never have to pick: from 19 seats the lower Organization price applies automatically.</p>
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
          <Marker n="09">Put it on your phone</Marker>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card space-y-1 p-5">
              <h2 className="font-display text-lg font-normal">iPhone</h2>
              <p className="text-sm text-text-muted">
                Open thesurfdesk.app in Safari, tap <strong className="text-text">Share</strong>, then{" "}
                <strong className="text-text">Add to Home Screen</strong>.
              </p>
            </div>
            <div className="card space-y-1 p-5">
              <h2 className="font-display text-lg font-normal">Android</h2>
              <p className="text-sm text-text-muted">
                Open thesurfdesk.app in Chrome, tap the <strong className="text-text">⋮</strong> menu, then{" "}
                <strong className="text-text">Add to Home screen</strong> (or <strong className="text-text">Install app</strong>).
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6 border-t border-border py-20 text-center sm:py-24">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
            Make space for <span className="text-accent">what matters.</span>
          </h2>
          <div className="mx-auto max-w-xl space-y-2 text-base leading-relaxed text-text-muted sm:text-lg">
            <p>Your day is already full. Keeping everything organized shouldn&apos;t make it harder.</p>
            <p>Bring it all together with Surfdesk.</p>
          </div>
          <Cta className="justify-center [&>p]:text-center" label="Start Your Free Trial" />
          <p className="pt-6 font-display text-sm font-light uppercase tracking-[0.25em] text-text-muted">
            Surfdesk. <span className="text-accent">Keep everything moving.</span>
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="pb-safe-5 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-8">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()}{" "}
            <a href="https://www.sonderproject.co" className="hover:text-text hover:underline">
              Sonder Project
            </a>
          </p>
          <LegalLinks />
        </div>
        <nav aria-label="Surfdesk for" className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-4 pb-8 text-xs text-text-muted sm:px-8">
          {[...LANDING_LINKS.map((l) => ({ path: l.path, label: l.label })), ...ALL_SEO_PAGES.map((p) => ({ path: p.path, label: p.eyebrow }))].map((p) => (
            <Link key={p.path} href={p.path} className="hover:text-text">
              {p.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
