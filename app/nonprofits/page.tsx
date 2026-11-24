import type { Metadata } from "next";
import { CommandDemo } from "@/components/landing/CommandDemo";
import { Benefits, Faq, Features, FinalCta, Hero, OtherAudiences, Pains, Section, Trust } from "@/components/marketing/landing/Kit";
import { PlanCards } from "@/components/marketing/landing/PlanCards";
import { LandingShell } from "@/components/marketing/landing/Shell";
import { Bars, CommandLine, Done, Frame, Person, Stats, TaskRow, Timeline } from "@/components/marketing/landing/Screens";
import { TrackedLink } from "@/components/marketing/landing/Track";
import { VideoSlot, type LandingVideo } from "@/components/marketing/landing/VideoSlot";
import { WorkflowDemo } from "@/components/marketing/landing/WorkflowDemo";
import { LANDING_LINKS, landingHref } from "@/lib/landing";
import { talkHref } from "@/lib/talk";

const PAGE = "nonprofits" as const;
const TITLE = "Surfdesk for Nonprofits | Programs & Impact";
const DESCRIPTION =
  "Programs, participants, staff, check-ins, follow-ups and Impact reports connected in one organized workspace for nonprofit teams. 14-day free team trial.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/nonprofits" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/nonprofits", siteName: "Surfdesk", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const TEAM = landingHref("/get-started/org", PAGE);
/** Demos are for large organizations; everyone else starts a trial. Swap for a booking link when there is one. */
const DEMO = talkHref("nonprofits");

/** A real screen recording goes here once it's made (docs/marketing/landing-demo-shots.md, shot C). */
const VIDEO: LandingVideo | null = null;

const FAQS = [
  {
    q: "Does Surfdesk replace HMIS?",
    a: "No. Surfdesk doesn't connect to HMIS or produce HUD reports. If your program documents in HMIS, keep doing that there. Surfdesk handles the work around it: staff coordination, tasks, follow-ups, scheduling, team chat and operational reporting. Programs that don't use HMIS can use Surfdesk as their main workspace.",
  },
  {
    q: "Is Surfdesk HIPAA compliant?",
    a: "Surfdesk encrypts data in transit and at rest and separates every organization with database-level access rules. It is not marketed as a HIPAA-covered system; if you handle protected health information, talk to us about your requirements before you start.",
  },
  {
    q: "Can we import our current participant list?",
    a: "Yes. Import from Excel or CSV, and Organization plans include onboarding help and data import.",
  },
  {
    q: "Do we need IT staff to run it?",
    a: "No. Surfdesk runs in the browser on any phone or computer, with nothing to install or maintain, and you can set it up in an afternoon.",
  },
  {
    q: "How much does it cost?",
    a: "Small Team is $19 per person per month, from 1 to 18 people. Organization is $349 a month with 20 seats included and $15 for each extra seat. Both start with a 14-day free trial. Larger organizations can ask about Enterprise pricing.",
  },
];

function DemoLink({ cta }: { cta: string }) {
  return (
    <p className="text-sm text-text-muted">
      Large organization or multiple programs?{" "}
      <TrackedLink page={PAGE} cta={cta} href={DEMO} className="font-medium text-accent hover:underline">
        Talk to us →
      </TrackedLink>
    </p>
  );
}

export default function NonprofitsPage() {
  return (
    <LandingShell
      page={PAGE}
      title={TITLE}
      description={DESCRIPTION}
      crumb="Surfdesk for nonprofits"
      primary={{ href: TEAM, label: "Get Started Free", short: "Get started" }}
      faqs={FAQS}
    >
      <Hero
        page={PAGE}
        eyebrow="For nonprofits"
        lead="Focus on your mission."
        accent="Not the administrative work."
        sub="Keep your programs, participants, staff, follow-ups, and impact reporting connected in one organized workspace."
        primary={{ href: TEAM, label: "Get Started Free", cta: "hero_primary" }}
        secondary={{ href: "#features", label: "Explore the Features", cta: "hero_secondary" }}
        fine="14-day free team trial · Set up in an afternoon · Cancel any time"
        extra={<DemoLink cta="demo_hero" />}
        aside={
          <div className="card space-y-4 p-5 sm:p-6">
            <p className="section-label">Staff just say it</p>
            <CommandDemo
              examples={[
                { said: "Jasmine – housing help", kind: "Check-in", detail: "Housing help · today · counted in Impact" },
                { said: "Marcus got the job at Amazon", kind: "Note", detail: "On Marcus's profile · record “Got a job” in one tap" },
                { said: "Check in with Rosa tomorrow", kind: "Follow-up", detail: "Tomorrow · linked to Rosa" },
                { said: "Add Omar to the Spring cohort", kind: "Group", detail: "Omar added to Spring cohort" },
              ]}
            />
          </div>
        }
      />

      <Section n="02" marker="Sound familiar?" title="Your team does great work." accent="The details are everywhere.">
        <Pains
          items={[
            "Participant notes live in a spreadsheet, a shared drive, sticky notes and someone's head.",
            "Reporting week means hand-counting people served from old notes.",
            "When a staff member leaves, their follow-ups and history go with them.",
          ]}
        />
      </Section>

      <Section
        id="how-it-works"
        n="03"
        marker="See it work"
        title="From referral"
        accent="to Impact report."
        lede={<p>One participant, start to finish. Every step below is something Surfdesk does today.</p>}
      >
        <WorkflowDemo
          page={PAGE}
          steps={[
            {
              title: "A partner sends a referral",
              body: "Partners use your referral link. Admins are notified the moment it arrives.",
              screen: (
                <Frame title="Referrals" right={<span className="tag">New</span>}>
                  <div className="rounded-xl border border-accent p-3 text-xs">
                    <span className="block text-sm font-semibold text-text">Jasmine Reyes</span>
                    <span className="block text-text-muted">From: County Health · Housing help</span>
                    <span className="block text-text-muted">Appointment Tue 10:30</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-bg">Accept</span>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-text-muted">Decline</span>
                  </div>
                </Frame>
              ),
            },
            {
              title: "Their profile appears",
              body: "Accept the referral and the participant's profile is created, with where they came from.",
              screen: (
                <Frame title="Participant">
                  <Person initials="JR" name="Jasmine Reyes" sub="Referred by County Health · today" />
                  <Timeline items={[{ when: "Today", text: "Referral accepted · Housing help", fresh: true }]} />
                </Frame>
              ),
            },
            {
              title: "A staff member is assigned",
              body: "Assign the participant to the right staff member. It's recorded in the activity log.",
              screen: (
                <Frame title="Activity log">
                  <Person initials="AP" name="Assigned to Andre P." sub="Member · 23 participants" />
                  <ul className="space-y-1 text-[11px] text-text-muted">
                    <li className="font-medium text-text">9:12 · Maria assigned Jasmine R. to Andre</li>
                    <li>9:05 · Maria accepted a referral from County Health</li>
                  </ul>
                </Frame>
              ),
            },
            {
              title: "A check-in is recorded",
              body: "One line logs the check-in and the service, on the participant's history.",
              screen: (
                <Frame title="Command box">
                  <CommandLine text="Jasmine – housing help" />
                  <Done title="Check-in logged" detail="Housing help · today · Jasmine Reyes" />
                </Frame>
              ),
            },
            {
              title: "A follow-up is set",
              body: "The next step lands on the staff member's list on the right day.",
              screen: (
                <Frame title="Andre's tasks">
                  <CommandLine text="Check in with Jasmine next Tuesday" />
                  <TaskRow title="Check in with Jasmine" when="Tue" fresh />
                  <TaskRow title="Call Rosa back" when="Today" tone="tag-v" />
                </Frame>
              ),
            },
            {
              title: "Managers review the activity",
              body: "The team dashboard shows each person's participants and today's check-ins. Managers can read records and leave comments.",
              screen: (
                <Frame title="Team dashboard">
                  <ul className="space-y-1.5 text-xs">
                    {[
                      ["Maria G.", "Manager", 18, 4],
                      ["Andre P.", "Member", 24, 6],
                      ["Kim L.", "Member", 15, 3],
                    ].map(([name, role, people, today]) => (
                      <li key={name as string} className="rounded-lg border border-border-subtle px-2 py-1.5">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium text-text">{name}</span>
                          <span className="text-text-muted">{role}</span>
                        </span>
                        <span className="block tabular-nums text-text-muted">
                          {people} participants · <strong className="text-accent">{today} check-ins today</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Frame>
              ),
            },
            {
              title: "Your Impact report reflects it",
              body: "People served, new vs returning, services and demographics, counted from the check-ins you record. PDF with your logo in one click.",
              screen: (
                <Frame title="Impact · November">
                  <Stats
                    items={[
                      ["213", "People served"],
                      ["65", "New"],
                      ["1.9", "Check-ins each"],
                    ]}
                  />
                  <Bars
                    rows={[
                      ["Housing help", 82],
                      ["Food assistance", 61],
                      ["Job readiness", 44],
                    ]}
                  />
                </Frame>
              ),
            },
          ]}
        />
        <VideoSlot page={PAGE} video={VIDEO} />
      </Section>

      <Section n="04" marker="Why it helps" title="Your programs. Your people." accent="Your impact. Connected.">
        <Benefits
          items={[
            {
              title: "Simple tools for staff",
              body: "Staff log a check-in or set a follow-up in one sentence, from any phone or computer. Less time on paperwork, more with people.",
            },
            {
              title: "A clear view for leadership",
              body: "See every staff member's participants and today's check-ins, plus an activity log of who did what.",
            },
            {
              title: "Impact you can show",
              body: "People served, outcomes and demographics are counted as your team works, ready for your board and funders.",
            },
          ]}
        />
      </Section>

      <Section id="features" n="05" marker="Features" title="Everything your programs run on.">
        <Features
          teamNote="Everything here is included on Small Team and Organization."
          items={[
            { title: "Participant profiles", body: "Contact details, notes, check-ins and follow-ups for every participant, on one timeline." },
            { title: "Check-ins and services", body: "Log a check-in and the service in one line." },
            { title: "Impact reporting", body: "People served, new vs returning, services and outcomes reached." },
            { title: "Demographic reporting", body: "Demographics in your Impact report, for funders and your board." },
            { title: "Referrals", body: "A referral link for partners and a referral log for your team." },
            { title: "Staff assignments", body: "Assign participants to staff and reassign when caseloads change." },
            { title: "Team dashboard", body: "Each staff member's participants and today's check-ins." },
            { title: "Team chat", body: "Channels, group and direct chats. Tag a participant in the conversation." },
            { title: "Follow-ups", body: "Follow-ups on the right day, plus automations for anyone who's gone quiet." },
            { title: "Tasks and reminders", body: "Every staff member's tasks on their own Today list. Tasks stay private to each person." },
            { title: "Front-desk kiosk", body: "Participants sign themselves in when they arrive." },
            { title: "Branded PDF reports", body: "Impact reports with your logo, in one click." },
            { title: "Activity log", body: "Who added, changed or moved what, and when." },
            { title: "Data export", body: "Excel, CSV or a full backup, any time." },
            { title: "Roles and permissions", body: "Admin, Manager and Member roles. Staff see only what their role allows." },
          ]}
        />
      </Section>

      <Section
        n="06"
        marker="Already using HMIS?"
        title="Already using HMIS?"
        accent="Surfdesk serves a different purpose."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-2 p-6">
            <p className="section-label">HMIS</p>
            <p className="text-base leading-relaxed text-text">HMIS supports required homelessness-service documentation and reporting.</p>
          </div>
          <div className="card space-y-2 p-6" style={{ borderColor: "var(--accent)" }}>
            <p className="section-label">Surfdesk</p>
            <p className="text-base leading-relaxed text-text">
              Surfdesk helps organizations manage the broader work happening around their programs, including staff coordination, everyday
              tasks, scheduling, team communication, and operational performance.
            </p>
          </div>
        </div>
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-text-muted">
          <p>
            Many organizations run programs and departments that don&apos;t use HMIS at all, such as workforce development, youth programs,
            food access and community outreach. Those teams can use Surfdesk as their main workspace.
          </p>
          <p>Surfdesk doesn&apos;t connect to HMIS or produce HUD reports, and it isn&apos;t a replacement for either.</p>
        </div>
      </Section>

      <Section n="07" marker="Your data" title="Built for sensitive work.">
        <Trust
          items={[
            { title: "Two-step sign-in", body: "A second step at sign-in, plus automatic sign-out on shared computers." },
            { title: "Encrypted", body: "Encrypted in transit and at rest." },
            { title: "Roles and permissions", body: "Admins, Managers and Members each see only what their role allows." },
            { title: "Organization data separation", body: "Database-level rules keep every organization's data walled off." },
            { title: "Activity log", body: "A record of who added, changed or moved what, and when." },
            { title: "Data export", body: "Export everything to Excel, CSV or a full backup. Your data is never sold." },
          ]}
        />
      </Section>

      <Section id="pricing" n="08" marker="Pricing" title="Simple team pricing" accent="that gets cheaper as you grow.">
        <PlanCards
          page={PAGE}
          plans={["team", "organization", "enterprise"]}
          featured="organization"
          calculator
          hrefs={{
            team: { href: TEAM, label: "Start a team trial" },
            organization: { href: TEAM, label: "Start a team trial" },
            enterprise: { href: DEMO, label: "Talk to us" },
          }}
        />
      </Section>

      <section className="space-y-6 border-t border-border py-16">
        <h2 className="font-display text-2xl font-light tracking-[-0.01em] sm:text-3xl">Questions</h2>
        <Faq items={FAQS} />
      </section>

      <FinalCta
        page={PAGE}
        title="More time for"
        accent="the work that matters."
        body={["Keep your team organized, your programs moving, and your impact visible."]}
        primary={{ href: TEAM, label: "Get Started Free", cta: "final_primary" }}
        fine="14-day free team trial · Cancel any time"
        extra={<DemoLink cta="demo_final" />}
      />

      <OtherAudiences links={LANDING_LINKS.filter((l) => l.key !== PAGE)} />
    </LandingShell>
  );
}
