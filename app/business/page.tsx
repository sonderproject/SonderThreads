import type { Metadata } from "next";
import Link from "next/link";
import { CommandDemo } from "@/components/landing/CommandDemo";
import { Benefits, Faq, Features, FinalCta, Hero, OtherAudiences, Pains, Section, Trust } from "@/components/marketing/landing/Kit";
import { PlanCards } from "@/components/marketing/landing/PlanCards";
import { LandingShell } from "@/components/marketing/landing/Shell";
import { Bars, Chat, CommandLine, Done, Frame, Mention, Person, Stats, TaskRow, Timeline } from "@/components/marketing/landing/Screens";
import { VideoSlot, type LandingVideo } from "@/components/marketing/landing/VideoSlot";
import { WorkflowDemo } from "@/components/marketing/landing/WorkflowDemo";
import { LANDING_LINKS, landingHref } from "@/lib/landing";
import { SUPPORT_EMAIL } from "@/lib/settings-options";

const PAGE = "business" as const;
const TITLE = "Surfdesk for Business | Clients, Teams & Insights";
const DESCRIPTION =
  "Customers, visits, bookings, follow-ups, your team and revenue in one connected workspace for small businesses and growing teams. 14-day free team trial.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/business" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/business", siteName: "Surfdesk", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const TEAM = landingHref("/get-started/org", PAGE);
const SOLO = landingHref("/get-started/solo", PAGE);
const ANY = landingHref("/get-started", PAGE);
const SALES = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Surfdesk Enterprise")}`;

/** A real screen recording goes here once it's made (docs/marketing/landing-demo-shots.md, shot B). */
const VIDEO: LandingVideo | null = null;

const FAQS = [
  {
    q: "Is Surfdesk a point-of-sale system?",
    a: "No. Surfdesk keeps your customers, visits, follow-ups and team together, and shows revenue from the prices of the services you log. Keep your POS for taking payments.",
  },
  {
    q: "Can I bring my customer list?",
    a: "Yes. Import from Excel or CSV in minutes. Organization plans include onboarding help and data import.",
  },
  {
    q: "I work on my own. Is this for me?",
    a: "Yes. The Individual plan is $9 a month with a 7-day free trial and no card. Move to a team plan when you hire.",
  },
  {
    q: "How much does a team plan cost?",
    a: "Small Team is $19 per person per month, from 1 to 18 people (a business of one included). Organization is $349 a month with 20 seats included and $15 for each extra seat. Both start with a 14-day free trial.",
  },
];

export default function BusinessPage() {
  return (
    <LandingShell
      page={PAGE}
      title={TITLE}
      description={DESCRIPTION}
      crumb="Surfdesk for business"
      primary={{ href: TEAM, label: "Get Started Free", short: "Get started" }}
      faqs={FAQS}
    >
      <Hero
        page={PAGE}
        eyebrow="For business"
        lead="Run your business."
        accent="Not five different apps."
        sub="Your customers, bookings, tasks, follow-ups, team, and revenue in one connected workspace."
        primary={{ href: TEAM, label: "Get Started Free", cta: "hero_primary" }}
        secondary={{ href: "#demo", label: "Watch the Demo", cta: "hero_secondary" }}
        fine="14-day free team trial · Set up in an afternoon · Cancel any time"
        extra={
          <p className="text-sm text-text-muted">
            Working on your own?{" "}
            <Link href={SOLO} className="font-medium text-accent hover:underline">
              Start the $9 Individual plan →
            </Link>
          </p>
        }
        aside={
          <div className="card space-y-4 p-5 sm:p-6">
            <p className="section-label">Say it. Surfdesk files it.</p>
            <CommandDemo
              examples={[
                { said: "Add Ana Ortiz as a new customer", kind: "Customer", detail: "Ana Ortiz · profile ready" },
                { said: "Ana – consultation $120", kind: "Visit", detail: "Consultation · $120 · today · on Ana's history" },
                { said: "Follow up with Ana in 3 weeks", kind: "Follow-up", detail: "In 3 weeks · linked to Ana" },
                { said: "Remind me to order supplies Monday", kind: "Task", detail: "Monday · on your Today list" },
              ]}
            />
          </div>
        }
      />

      <Section
        n="02"
        marker="Sound familiar?"
        title="Customers in your texts. Bookings in your calendar."
        accent="Numbers in a spreadsheet."
      >
        <Pains
          items={[
            "Customer details live in your phone, a notebook and your head.",
            "Regulars drift away and you only notice months later.",
            "You can't easily tell which services actually bring in the money.",
          ]}
        />
      </Section>

      <Section
        id="demo"
        n="03"
        marker="See it work"
        title="From new customer"
        accent="to real numbers."
        lede={<p>One customer, start to finish. Every step below is something Surfdesk does today.</p>}
      >
        <WorkflowDemo
          page={PAGE}
          steps={[
            {
              title: "Add a customer",
              body: "Type it, say it, or import your whole list. Their profile is ready right away.",
              screen: (
                <Frame title="Command box">
                  <CommandLine text="Add Ana Ortiz as a new customer" />
                  <Done title="Customer added" detail="Ana Ortiz · profile ready" />
                </Frame>
              ),
            },
            {
              title: "Log a visit",
              body: "One line logs the service and the price, linked to the right customer.",
              screen: (
                <Frame title="Command box">
                  <CommandLine text="Ana – consultation $120" />
                  <Done title="Visit logged" detail="Consultation · $120 · today" />
                </Frame>
              ),
            },
            {
              title: "Her history updates",
              body: "Every visit, note and follow-up lands on one timeline, so you always know where things stand.",
              screen: (
                <Frame title="Customer">
                  <Person initials="AO" name="Ana Ortiz" sub="Customer since October · 4 visits" />
                  <Timeline
                    items={[
                      { when: "Today", text: "Visit · Consultation · $120", fresh: true },
                      { when: "Nov 3", text: "Note: prefers Saturday mornings" },
                      { when: "Oct 12", text: "Visit · Color · $120" },
                    ]}
                  />
                </Frame>
              ),
            },
            {
              title: "Set the follow-up",
              body: "Say when to reach out next, or let an automation add follow-ups for you. It shows up on the right day.",
              screen: (
                <Frame title="Tasks">
                  <CommandLine text="Follow up with Ana in 3 weeks" />
                  <TaskRow title="Follow up with Ana" when="Dec 14" fresh />
                  <TaskRow title="Order supplies" when="Mon" tone="tag-v" />
                </Frame>
              ),
            },
            {
              title: "See it in Insights",
              body: "Visits, new and repeat customers, your busiest times and revenue by service, from the visits you log.",
              screen: (
                <Frame title="Insights · November">
                  <Stats
                    items={[
                      ["$4,820", "Revenue"],
                      ["142", "Visits"],
                      ["38", "New customers"],
                    ]}
                  />
                  <Bars
                    rows={[
                      ["Consultation", 70, "$1,935"],
                      ["Strategy call", 56, "$1,560"],
                      ["Follow-up session", 30, "$820"],
                    ]}
                  />
                  <p className="text-xs text-text-muted">
                    Busiest: <strong className="text-text">Tue 10 AM</strong>
                  </p>
                </Frame>
              ),
            },
          ]}
        />
        <VideoSlot page={PAGE} video={VIDEO} />
      </Section>

      <Section n="04" marker="Why it helps" title="Know your customers. Know your numbers." accent="Know what's next.">
        <Benefits
          items={[
            {
              title: "Know your customers",
              body: "Every customer's visits, notes, bookings and follow-ups on one page. Walk in knowing their story.",
            },
            {
              title: "Know your numbers",
              body: "See revenue by service, new vs repeat customers and your busiest days, from the visits you already log.",
            },
            {
              title: "Know what's next",
              body: "Follow-ups and tasks land on the right day, so regulars stay regulars and nothing gets forgotten.",
            },
          ]}
        />
      </Section>

      <Section id="features" n="05" marker="Features" title="Everything your business runs on.">
        <Features
          teamNote="Team plans = Small Team and Organization."
          items={[
            { title: "Customer profiles", body: "Contact details, notes, visits and follow-ups for every customer, on one timeline." },
            { title: "Visits and services", body: "Log a visit and the service in one line. Set prices once and they fill in." },
            { title: "Revenue Insights", body: "Revenue by service, new vs repeat customers and busiest times, every month." },
            { title: "Follow-up reminders", body: "Follow-ups on the right day, plus automations for quiet customers and birthdays." },
            { title: "Booking link", body: "Share a link and let customers book a time with you." },
            { title: "Calendar sync", body: "Link Google, Apple or Outlook, and see Calendly bookings alongside your tasks." },
            { title: "Customer import", body: "Bring your list from Excel or CSV in minutes." },
            { title: "Shared customer list", body: "Your whole team works from one list of customers.", team: true },
            { title: "Assignments and permissions", body: "Assign customers to staff, with Admin, Manager and Member roles.", team: true },
            { title: "Team chat", body: "Channels, group chats and direct messages. Tag a customer right in the conversation.", team: true },
            { title: "Branded reports", body: "Insights as a polished PDF with your logo.", team: true },
            { title: "Check-in kiosk", body: "A front-desk screen where customers sign themselves in.", team: true },
          ]}
        />
      </Section>

      <Section
        n="06"
        marker="For teams"
        title="Your team,"
        accent="on the same page."
        lede={<p>Everyone works from the same customer list, while each person&apos;s own tasks and notes stay private.</p>}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <figure className="card space-y-2.5 p-4">
            <p className="eyebrow text-text-faint">Team chat · #front-desk</p>
            <div aria-hidden>
              <Chat
                lines={[
                  { who: "Maria", text: <>Can someone take <Mention>#Ana O.</Mention> at 3?</> },
                  { who: "Andre", text: "On it. She's on my list.", mine: true },
                ]}
              />
            </div>
            <figcaption className="text-xs text-text-muted">Private chats stay private, even from admins.</figcaption>
          </figure>
          <figure className="card space-y-2.5 p-4">
            <p className="eyebrow text-text-faint">Team dashboard</p>
            <ul className="space-y-1.5 text-xs" aria-hidden>
              {[
                ["Maria G.", "Manager", 64, 7],
                ["Andre P.", "Member", 51, 5],
                ["Kim L.", "Member", 38, 4],
              ].map(([name, role, customers, today]) => (
                <li key={name as string} className="rounded-lg border border-border-subtle px-2 py-1.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text">{name}</span>
                    <span className="text-text-muted">{role}</span>
                  </span>
                  <span className="block tabular-nums text-text-muted">
                    {customers} customers · <strong className="text-accent">{today} visits today</strong>
                  </span>
                </li>
              ))}
            </ul>
            <figcaption className="text-xs text-text-muted">Managers see every person&apos;s customers and visits today.</figcaption>
          </figure>
          <figure className="card space-y-2.5 p-4">
            <p className="eyebrow text-text-faint">Activity log</p>
            <ul className="space-y-1 text-[11px] leading-snug text-text-muted" aria-hidden>
              {[
                ["9:41", "Andre logged a visit for Luis M."],
                ["9:12", "Maria moved 3 customers to Kim"],
                ["8:57", "Kim updated Ana O.'s phone"],
                ["8:30", "Kiosk: 2 customers signed in"],
              ].map(([t, line]) => (
                <li key={t} className="flex gap-2">
                  <span className="w-8 shrink-0 tabular-nums text-text-faint">{t}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <figcaption className="text-xs text-text-muted">Who changed what, and when.</figcaption>
          </figure>
        </div>
        <Features
          items={[
            { title: "Shared customer records", body: "One list the whole team works from." },
            { title: "Team chat", body: "Channels for everyone, plus private group and direct chats." },
            { title: "Assignments", body: "Give each customer an owner, and reassign in a tap." },
            { title: "Permissions", body: "Admin, Manager and Member roles. Staff see what their role allows." },
            { title: "Activity history", body: "A log of who added, changed or moved what." },
            { title: "Manager visibility", body: "Managers can read customer records and leave comments, never anyone's private tasks." },
          ]}
        />
      </Section>

      <Section n="07" marker="Your data" title="Built to keep your business data safe.">
        <Trust
          items={[
            { title: "Encrypted", body: "Encrypted in transit and at rest." },
            { title: "Two-step sign-in", body: "A second step at sign-in, plus automatic sign-out on shared computers." },
            { title: "Roles and permissions", body: "Staff see only what their role allows." },
            { title: "Walled off", body: "Database-level rules keep every business's data separate." },
            { title: "Activity log", body: "See who changed what, and when (team plans)." },
            { title: "Export any time", body: "Excel, CSV or a full backup. Your data is never sold." },
          ]}
        />
      </Section>

      <Section id="pricing" n="08" marker="Pricing" title="Simple pricing that gets cheaper" accent="as your team grows.">
        <PlanCards
          page={PAGE}
          plans={["individual", "team", "organization", "enterprise"]}
          featured="team"
          calculator
          hrefs={{
            individual: { href: SOLO, label: "Start your free trial" },
            team: { href: TEAM, label: "Start your team trial" },
            organization: { href: TEAM, label: "Start your team trial" },
            enterprise: { href: SALES, label: "Contact sales" },
          }}
        />
      </Section>

      <section className="space-y-6 border-t border-border py-16">
        <h2 className="font-display text-2xl font-light tracking-[-0.01em] sm:text-3xl">Questions</h2>
        <Faq items={FAQS} />
      </section>

      <FinalCta
        page={PAGE}
        title="Your business has enough moving parts."
        accent="Keep them together."
        body={["Customers, visits, follow-ups, your team and your numbers, in one place."]}
        primary={{ href: ANY, label: "Get Started Free", cta: "final_primary" }}
        fine="14-day free team trial · 7 days free for individuals · Cancel any time"
      />

      <OtherAudiences links={LANDING_LINKS.filter((l) => l.key !== PAGE)} />
    </LandingShell>
  );
}
