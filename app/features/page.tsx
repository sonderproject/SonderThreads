import type { Metadata } from "next";
import { Faq, Features, FinalCta, Hero, OtherAudiences, Section, Trust } from "@/components/marketing/landing/Kit";
import { LandingShell } from "@/components/marketing/landing/Shell";
import { CommandDemo } from "@/components/landing/CommandDemo";
import { LANDING_LINKS, landingHref } from "@/lib/landing";

const PAGE = "features" as const;
const TITLE = "Surfdesk Features | Tasks, Notes, Clients, Reports & Team Chat";
const DESCRIPTION =
  "Everything Surfdesk does: smart command box and voice, tasks, notes, lists, calendar sync, client profiles, visits, Insights and Impact reports, team chat and more.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/features" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/features", siteName: "Surfdesk", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const START = landingHref("/get-started", PAGE);

/** [feature, included in Individual]. Team plans include everything. */
const COMPARE: [string, boolean][] = [
  ["Tasks, notes, lists, calendar and reminders", true],
  ["Smart command box and voice capture", true],
  ["Clients and customers with full history", true],
  ["Visits or check-ins, services and outcomes", true],
  ["Insights dashboard", true],
  ["Booking link and calendar sync", true],
  ["Export everything (Excel, CSV, full backup)", true],
  ["One shared client list the whole team works from", false],
  ["Team chat: channels, group chats and direct messages", false],
  ["Roles for Admins, Managers and Members", false],
  ["Team dashboard: each person's clients and today's visits", false],
  ["Activity log of who changed what", false],
  ["Branded PDF reports with your logo", false],
  ["Referral link and referral log", false],
  ["Front-desk check-in kiosk", false],
  ["Client reassignment and manager comments", false],
];

const FAQS = [
  {
    q: "What's the difference between Individual and team plans?",
    a: "Individual is your own private workspace. Team plans (Business and Organization) add a shared client list, team chat, roles, a team dashboard, an activity log, branded reports, referrals and a check-in kiosk.",
  },
  {
    q: "Is there an app to download?",
    a: "Surfdesk runs in your browser on any phone or computer. Add it to your home screen and it opens like an app, full screen, with its own icon.",
  },
  {
    q: "Can I import my existing clients?",
    a: "Yes. Import from Excel or CSV in minutes, and export everything any time.",
  },
  {
    q: "Can my manager see my tasks?",
    a: "No. Tasks and personal notes stay private to you, even on team plans. Managers can read client records and leave comments.",
  },
];

export default function FeaturesPage() {
  return (
    <LandingShell
      page={PAGE}
      title={TITLE}
      description={DESCRIPTION}
      crumb="Features"
      primary={{ href: START, label: "Get Started Free", short: "Get started" }}
      faqs={FAQS}
    >
      <Hero
        page={PAGE}
        eyebrow="Features"
        lead="Everything Surfdesk does."
        accent="In one place."
        sub="Your tasks, notes, reminders, calendar, clients, reports and team, connected. Here's the full list."
        primary={{ href: START, label: "Get Started Free", cta: "hero_primary" }}
        secondary={{ href: "#compare", label: "Compare plans", cta: "hero_secondary" }}
        fine="7-day free trial · No card needed · Works on any phone or computer"
        aside={
          <div className="card space-y-4 p-5 sm:p-6">
            <p className="section-label">Say it once</p>
            <CommandDemo />
          </div>
        }
      />

      <Section n="02" marker="Everyday organization" title="Get everything out of your head." accent="And into one place.">
        <Features
          items={[
            { title: "Smart command box", body: "Type a sentence and it becomes a task, note, list item, reminder or visit, filed in the right place." },
            { title: "Voice capture", body: "Tap the mic and say it. Great between appointments or on the go." },
            { title: "Tasks and repeats", body: "Due dates, times and repeats like “every Monday” or “every month”." },
            { title: "Today view", body: "What's due, what's overdue and what's next, every time you open the app." },
            { title: "Notes and lists", body: "Shopping lists, ideas and notes. Notes that mention a to-do suggest the task for you." },
            { title: "Calendar sync", body: "Link Google, Apple or Outlook, see Calendly bookings, and subscribe to your Surfdesk calendar." },
            { title: "Search everything", body: "People, notes, tasks and lists in one search." },
            { title: "Automations", body: "Follow-up tasks after you add someone, check-ins when someone goes quiet, and birthday reminders." },
            { title: "Booking link", body: "Share a link and let people book a time with you." },
          ]}
        />
      </Section>

      <Section n="03" marker="Clients and customers" title="Everyone's story," accent="on one page.">
        <Features
          items={[
            { title: "Profiles with history", body: "Notes, visits, tasks and follow-ups on one timeline for every client or customer." },
            { title: "Visits and services", body: "Log a visit and the service in one line. Set prices once and revenue is counted for you." },
            { title: "Outcomes", body: "Record results people reach, like a new job or housing, in one tap from a note." },
            { title: "Custom fields", body: "Track the extra details your work needs on each person." },
            { title: "Import and export", body: "Bring your list from Excel or CSV. Export everything any time." },
            { title: "Insights and Impact", body: "Visits, new vs returning, busiest times, revenue by service, or people served with demographics." },
          ]}
        />
      </Section>

      <Section
        n="04"
        marker="For teams"
        title="Your team,"
        accent="on the same page."
        lede={<p>Everything on team plans, while each person&apos;s own tasks and notes stay private.</p>}
      >
        <Features
          teamNote="Team plans = Business and Organization."
          items={[
            { title: "Shared client list", body: "Everyone works from one list, with Admin, Manager and Member roles.", team: true },
            { title: "Team chat", body: "Channels, group and direct chats. Tag a client or share a note. Admins can't read chats they're not in.", team: true },
            { title: "Team dashboard", body: "Each person's clients, today's visits and services, and their calendar.", team: true },
            { title: "Activity log", body: "Who added, changed or moved what, and when.", team: true },
            { title: "Manager comments", body: "Managers can read client records and comment. Never anyone's tasks or personal notes.", team: true },
            { title: "Branded reports", body: "Insights or Impact reports as a PDF with your logo.", team: true },
            { title: "Referrals", body: "A referral link for partners and a referral log for your team.", team: true },
            { title: "Check-in kiosk", body: "A front-desk screen where people sign themselves in.", team: true },
            { title: "Reassign in a tap", body: "Move clients between staff when caseloads change.", team: true },
          ]}
        />
      </Section>

      <Section n="05" marker="Your data" title="Your data is yours." accent="Full stop.">
        <Trust
          items={[
            { title: "Never sold", body: "We never sell your data or use it for ads. It's used only to run Surfdesk for you." },
            { title: "Encrypted", body: "Encrypted in transit and at rest, with two-step sign-in and automatic sign-out on shared computers." },
            { title: "Walled off", body: "Database-level rules keep every account and organization separate. Staff see only what their role allows." },
            { title: "Yours to take or delete", body: "Export to Excel, CSV or a full backup any time. Delete your account and your data goes with it." },
          ]}
        />
      </Section>

      <Section id="compare" n="06" marker="Compare plans" title="Individual or team?">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-b border-border text-left text-text-faint">
                <th className="px-4 py-3 font-semibold">Feature</th>
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
          Individual is $9/month. Business is $19/person/month for 1–18 people. Organization is $349/month with 20 seats included.{" "}
          <a href="/#pricing" className="font-medium text-accent hover:underline">
            See pricing
          </a>
        </p>
      </Section>

      <Section n="07" marker="On your phone" title="Put it on your home screen.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card space-y-1 p-5">
            <h3 className="font-display text-lg font-normal">iPhone</h3>
            <p className="text-sm text-text-muted">
              Open thesurfdesk.app in Safari, tap <strong className="text-text">Share</strong>, then <strong className="text-text">Add to Home Screen</strong>.
            </p>
          </div>
          <div className="card space-y-1 p-5">
            <h3 className="font-display text-lg font-normal">Android</h3>
            <p className="text-sm text-text-muted">
              Open thesurfdesk.app in Chrome, tap the <strong className="text-text">⋮</strong> menu, then <strong className="text-text">Add to Home screen</strong> (or{" "}
              <strong className="text-text">Install app</strong>).
            </p>
          </div>
        </div>
      </Section>

      <section className="space-y-6 border-t border-border py-16">
        <h2 className="font-display text-2xl font-light tracking-[-0.01em] sm:text-3xl">Questions</h2>
        <Faq items={FAQS} />
      </section>

      <FinalCta
        page={PAGE}
        title="Make space for"
        accent="what matters."
        body={["Bring your tasks, notes, clients and team together with Surfdesk."]}
        primary={{ href: START, label: "Get Started Free", cta: "final_primary" }}
        fine="7-day free trial · No card needed · Cancel any time"
      />

      <OtherAudiences links={LANDING_LINKS} />
    </LandingShell>
  );
}
