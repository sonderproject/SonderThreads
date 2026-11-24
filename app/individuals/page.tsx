import type { Metadata } from "next";
import Link from "next/link";
import { CommandDemo } from "@/components/landing/CommandDemo";
import { Benefits, Faq, Features, FinalCta, Hero, OtherAudiences, Pains, Section, Trust } from "@/components/marketing/landing/Kit";
import { PlanCards } from "@/components/marketing/landing/PlanCards";
import { LandingShell } from "@/components/marketing/landing/Shell";
import { CommandLine, Done, Frame, MiniWeek, TaskRow } from "@/components/marketing/landing/Screens";
import { VideoSlot, type LandingVideo } from "@/components/marketing/landing/VideoSlot";
import { WorkflowDemo } from "@/components/marketing/landing/WorkflowDemo";
import { LANDING_LINKS, landingHref } from "@/lib/landing";

const PAGE = "individuals" as const;
const TITLE = "Surfdesk for Individuals | Tasks, Notes & Reminders";
const DESCRIPTION =
  "Your tasks, notes, reminders, lists and calendar in one simple app. Just type or say it and Surfdesk keeps it organized. 7-day free trial, no card needed.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/individuals" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/individuals", siteName: "Surfdesk", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const START = landingHref("/get-started/solo", PAGE);
const OFFER = landingHref("/get-started/solo?offer=skip", PAGE);

/** A real screen recording goes here once it's made (docs/marketing/landing-demo-shots.md, shot A). */
const VIDEO: LandingVideo | null = null;

const FAQS = [
  {
    q: "Do I need a credit card to try it?",
    a: "No. The Individual plan starts with a 7-day free trial and no card. After that it's $9 a month, and you can cancel any time.",
  },
  {
    q: "Is it only for people with clients?",
    a: "No. Most people start with tasks, notes, lists and their calendar. If you freelance or run a side business, client tracking is there when you need it.",
  },
  {
    q: "Can anyone else see my things?",
    a: "No. Your Individual workspace is private to you. Your data is never sold or used for ads, and you can export or delete it any time.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Surfdesk works in any browser on any phone or computer, and you can add it to your home screen like an app.",
  },
];

export default function IndividualsPage() {
  return (
    <LandingShell
      page={PAGE}
      title={TITLE}
      description={DESCRIPTION}
      crumb="Surfdesk for individuals"
      primary={{ href: START, label: "Get Started Free", short: "Get started" }}
      faqs={FAQS}
    >
      <Hero
        page={PAGE}
        eyebrow="For individuals"
        lead="Everything on your mind."
        accent="Finally in one place."
        sub="Your tasks, notes, reminders, lists, and calendar, all working together. Just type or say what you need, and Surfdesk keeps it organized."
        primary={{ href: START, label: "Get Started Free", cta: "hero_primary" }}
        secondary={{ href: "#how-it-works", label: "See How It Works", cta: "hero_secondary" }}
        fine="7-day free trial · No card needed · $9/month after"
        aside={
          <div className="card space-y-4 p-5 sm:p-6">
            <p className="section-label">Just say it</p>
            <CommandDemo
              examples={[
                { said: "Remind me to send the proposal Friday", kind: "Task", detail: "Friday · on your Today list and calendar" },
                { said: "Add milk and eggs to my shopping list", kind: "List items", detail: "Added to your Shopping list" },
                { said: "Note: gift ideas for Mom's birthday", kind: "Note", detail: "Saved to your notes" },
                { said: "Water the plants every Sunday", kind: "Repeating task", detail: "Every Sunday" },
              ]}
            />
          </div>
        }
      />

      <Section
        n="02"
        marker="Sound familiar?"
        title="Five apps, a few sticky notes,"
        accent="and your memory."
        lede={<p>When your life is spread across apps, keeping track becomes its own job.</p>}
      >
        <Pains
          items={[
            "Your to-dos are in one app, your notes in another, your appointments in a third.",
            "You write things down, then can't find them when you need them.",
            "You end the day still holding a list of things in your head.",
          ]}
        />
      </Section>

      <Section
        id="how-it-works"
        n="03"
        marker="How it works"
        title="One sentence."
        accent="Everything where it belongs."
        lede={<p>Type it or tap the mic and say it. Here&apos;s what happens to one reminder.</p>}
      >
        <WorkflowDemo
          page={PAGE}
          steps={[
            {
              title: "Say it",
              body: "Type or speak it the way you'd say it to a friend. No forms.",
              screen: (
                <Frame title="Command box">
                  <CommandLine text="Remind me to send the proposal Friday" mic />
                  <p className="text-xs text-text-muted">Type it, or tap the mic and say it.</p>
                </Frame>
              ),
            },
            {
              title: "Surfdesk creates the task",
              body: "It understands the task and the day, and files it for you.",
              screen: (
                <Frame title="Command box">
                  <CommandLine text="Remind me to send the proposal Friday" />
                  <Done title="Task created" detail="Send the proposal · Friday" />
                </Frame>
              ),
            },
            {
              title: "It's on your list",
              body: "The task joins your tasks with its due date, next to everything else you have going on.",
              screen: (
                <Frame title="Tasks">
                  <TaskRow title="Send the proposal" when="Fri" fresh />
                  <TaskRow title="Book the dentist" when="Mon" tone="tag-v" />
                  <TaskRow title="Renew car registration" when="Overdue" tone="tag-u" />
                  <TaskRow title="Pick up dry cleaning" done />
                </Frame>
              ),
            },
            {
              title: "It's on your calendar",
              body: "Anything with a date shows on your Surfdesk calendar, beside your Google, Apple or Outlook events if you link them.",
              screen: (
                <Frame title="This week">
                  <MiniWeek day={4} dots={[0, 2, 4, 5]} />
                  <div className="space-y-1.5 text-xs">
                    <p className="rounded-lg bg-accent-soft px-3 py-2 text-text">Fri · Send the proposal</p>
                    <p className="rounded-lg bg-bg px-3 py-2 text-text-muted">Fri 6:30 PM · Dinner with Sam (Google)</p>
                  </div>
                </Frame>
              ),
            },
            {
              title: "Friday, it's on your Today list",
              body: "Open Surfdesk and see what's due today and what's overdue, in one short list. Check it off when it's done.",
              screen: (
                <Frame title="Today">
                  <TaskRow title="Send the proposal" when="Due today" fresh />
                  <TaskRow title="Call the landlord" when="2:00 PM" tone="tag-v" />
                  <TaskRow title="Water the plants" done />
                </Frame>
              ),
            },
          ]}
        />
        <VideoSlot page={PAGE} video={VIDEO} />
      </Section>

      <Section n="04" marker="Why it helps" title="Less to remember." accent="More room to think.">
        <Benefits
          items={[
            {
              title: "Get it out of your head",
              body: "The moment you think of something, say it or type it. It's saved in seconds, so you can stop holding onto it.",
            },
            {
              title: "Know what's next",
              body: "Your Today list shows what's due and what's overdue. One short list instead of five apps and a notebook.",
            },
            {
              title: "Find anything later",
              body: "Search every task, note, list and person at once. No more digging through apps to find the one thing you wrote down.",
            },
          ]}
        />
      </Section>

      <Section n="05" marker="What's inside" title="Everything you need to stay on top of things.">
        <div className="grid gap-4 lg:grid-cols-4">
          {[
            {
              title: "Shopping list",
              screen: (
                <>
                  <CommandLine text="Add milk and eggs to my shopping list" />
                  <TaskRow title="Milk" fresh />
                  <TaskRow title="Eggs" fresh />
                  <TaskRow title="Coffee" done />
                </>
              ),
            },
            {
              title: "Reminder",
              screen: (
                <>
                  <CommandLine text="Call the dentist Monday at 10" />
                  <Done title="Task created" detail="Call the dentist · Mon 10:00 AM" />
                </>
              ),
            },
            {
              title: "Note",
              screen: (
                <>
                  <CommandLine text="Note: gift ideas for Mom's birthday" />
                  <div className="rounded-xl border border-border-subtle p-3 text-xs text-text-muted">
                    <span className="block font-semibold text-text">Gift ideas for Mom&apos;s birthday</span>
                    Saved to your notes
                  </div>
                </>
              ),
            },
            {
              title: "Your day",
              screen: (
                <>
                  <MiniWeek day={2} dots={[1, 2, 4]} />
                  <TaskRow title="Send the proposal" when="Today" />
                  <TaskRow title="Gym at 6" when="6:00 PM" tone="tag-v" />
                </>
              ),
            },
          ].map((d) => (
            <figure key={d.title} className="card space-y-2.5 p-4" aria-label={d.title}>
              <p className="eyebrow text-text-faint">{d.title}</p>
              <div className="space-y-2" aria-hidden>
                {d.screen}
              </div>
            </figure>
          ))}
        </div>
        <Features
          items={[
            { title: "Smart command box and voice", body: "Type or say it once. Surfdesk turns it into a task, note, list item or reminder." },
            { title: "Tasks and repeating tasks", body: "Due dates, times and repeats like “every Sunday” or “every month”." },
            { title: "Notes and lists", body: "Shopping lists, packing lists, ideas and notes, all in one place." },
            { title: "Calendar", body: "Your tasks and birthdays on one calendar, with Google, Apple or Outlook linked in." },
            { title: "Today view", body: "What's due, what's overdue and what's next, every time you open the app." },
            { title: "Search everything", body: "Find any task, note, list or person in one search." },
            { title: "Private workspace", body: "Your Individual account is yours alone. Nobody else can see it." },
            { title: "Clients, if you need them", body: "Freelance or run something on the side? Keep each client's notes and follow-ups too." },
          ]}
        />
      </Section>

      <Section n="06" marker="Private by design" title="Your things stay yours.">
        <Trust
          items={[
            { title: "Never sold", body: "We never sell your data or use it for ads." },
            { title: "Encrypted", body: "Encrypted in transit and at rest." },
            { title: "Two-step sign-in", body: "Add a second step at sign-in, plus automatic sign-out on shared computers." },
            { title: "Yours to export", body: "Export everything to Excel, CSV or a full backup any time." },
            { title: "Yours to delete", body: "Delete your account and your data is deleted with it." },
            { title: "Works everywhere", body: "Any phone or computer, in the browser. Add it to your home screen." },
          ]}
        />
      </Section>

      <Section id="pricing" n="07" marker="Pricing" title="One simple price." accent="Try it free first.">
        <PlanCards
          page={PAGE}
          plans={["individual"]}
          featured="individual"
          hrefs={{ individual: { href: START, label: "Start your free trial" } }}
          note={false}
        />
        <p className="text-sm text-text-muted">
          Ready now?{" "}
          <Link href={OFFER} className="font-medium text-accent hover:underline">
            Skip the trial and get 30% off your first month →
          </Link>{" "}
          Working with a team?{" "}
          <Link href="/business#pricing" className="font-medium text-accent hover:underline">
            See team plans
          </Link>
          .
        </p>
      </Section>

      <section className="space-y-6 border-t border-border py-16">
        <h2 className="font-display text-2xl font-light tracking-[-0.01em] sm:text-3xl">Questions</h2>
        <Faq items={FAQS} />
      </section>

      <FinalCta
        page={PAGE}
        title="Get organized"
        accent="without making it another task."
        body={["Start with one sentence. Surfdesk takes it from there."]}
        primary={{ href: START, label: "Get Started Free", cta: "final_primary" }}
        fine="7-day free trial · No card needed · Cancel any time"
      />

      <OtherAudiences links={LANDING_LINKS.filter((l) => l.key !== PAGE)} />
    </LandingShell>
  );
}
