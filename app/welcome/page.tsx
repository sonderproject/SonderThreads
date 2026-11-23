import type { Metadata } from "next";
import { PlanCards } from "@/components/marketing/landing/PlanCards";
import { LandingShell } from "@/components/marketing/landing/Shell";
import { TrackedLink } from "@/components/marketing/landing/Track";
import { AppFold } from "@/components/marketing/v2/AppFold";
import { AudienceExplorer } from "@/components/marketing/v2/AudienceExplorer";
import { Aurora } from "@/components/marketing/v2/Decor";
import { InsightsShowcase } from "@/components/marketing/v2/InsightsShowcase";
import { ProductHero } from "@/components/marketing/v2/ProductHero";
import { StickyCta } from "@/components/marketing/v2/StickyCta";
import { TeamChat } from "@/components/marketing/v2/TeamChat";
import { TryIt } from "@/components/marketing/v2/TryIt";
import { landingHref } from "@/lib/landing";
import { SUPPORT_EMAIL } from "@/lib/settings-options";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { INDIVIDUAL_CENTS, ORG_BASE_CENTS, SEAT_CENTS } from "@/lib/pricing";

/**
 * The homepage (Nov 23, 2026). Signed-out visitors to "/" are shown this page (middleware
 * rewrites to it), so "/" is the canonical address. Full-width sections alternate sand, white,
 * dark, soft blue and a surf-blue close: product hero, a working "try it now" command box
 * (lib/try-it.ts), the five-apps fold, the app's real Insights/Impact charts with sample data,
 * team chat, a day without vs with Surfdesk per audience, pricing.
 */
export const metadata: Metadata = {
  title: { absolute: "Surfdesk | Tasks, Notes, Clients & Teams in One App" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: "Surfdesk", description: SITE_DESCRIPTION, url: "/", siteName: "Surfdesk", type: "website" },
  twitter: { card: "summary_large_image", title: "Surfdesk", description: SITE_DESCRIPTION },
};

/** Structured data for search engines: the app, its plans (from lib/pricing.ts), and who makes it. */
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
      offers: [
        { name: "Individual", price: INDIVIDUAL_CENTS / 100, description: "Per month. 7-day free trial, no card needed." },
        { name: "Small Team", price: SEAT_CENTS / 100, description: "Per user per month, 2-18 people. 14-day free trial." },
        { name: "Organization", price: ORG_BASE_CENTS / 100, description: "Per month, 20 seats included. 14-day free trial." },
      ].map((o) => ({ "@type": "Offer", priceCurrency: "USD", url: SITE_URL, ...o })),
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

/** The calendar in the hero shows today; refresh the page hourly. */
export const revalidate = 3600;

const PAGE = "home" as const;
const START = landingHref("/get-started", PAGE);
const SOLO = landingHref("/get-started/solo", PAGE);
const TEAM = landingHref("/get-started/org", PAGE);
const SALES = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Surfdesk Enterprise")}`;

const WRAP = "relative mx-auto max-w-6xl px-4 sm:px-8";
const PRIMARY =
  "rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-bg shadow-sm ring-1 ring-inset ring-white/15 transition-colors hover:bg-accent-dim";
const SECONDARY = "rounded-full border border-border bg-bg-raised px-7 py-3.5 text-sm font-semibold text-text transition-colors hover:bg-bg-hover";

const TRUST = ["Encrypted in transit and at rest", "Two-step sign-in", "Roles and permissions", "Every account walled off", "Export everything, any time", "Never sold"];

const CHAT_POINTS = [
  "Channels for the whole team, plus private group and direct chats.",
  "Tag a client or share a note right in the conversation.",
  "Private chats stay private. Admins can't read chats they're not in.",
  "Phone alerts never show the message text.",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.25em] text-text-muted">
      <span className="h-px w-10" style={{ background: "color-mix(in srgb, var(--accent) 55%, transparent)" }} aria-hidden />
      {children}
    </p>
  );
}

function H2({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <h2 className="max-w-3xl font-display text-4xl font-light leading-[1.08] tracking-[-0.02em] sm:text-5xl">
      {children} <span className="text-accent">{accent}</span>
    </h2>
  );
}

export default function WelcomePage() {
  return (
    <LandingShell
      page={PAGE}
      wide
      title="Surfdesk | Tasks, Notes, Clients & Teams in One App"
      description="Organize your tasks, notes, reminders, calendar, clients, and team in one simple workspace."
      primary={{ href: START, label: "Get Started Free", short: "Get started" }}
      after={<StickyCta page={PAGE} href={START} />}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      {/* 1. Hero: color glows and dot texture on sand, the promise, then the product, big. */}
      <section className="relative overflow-hidden">
        <Aurora />
        <div className="dots pointer-events-none absolute inset-0" aria-hidden />
        <div className={`${WRAP} space-y-10 pb-12 pt-12 text-center sm:pt-16`}>
          <div className="mx-auto max-w-4xl space-y-6">
            <p className="eyebrow text-text-faint">Tasks · Notes · Clients · Teams</p>
            <h1 className="font-display text-[2.6rem] font-light leading-[1.03] tracking-[-0.03em] sm:text-7xl">
              <span className="whitespace-nowrap">Your day.</span> <span className="whitespace-nowrap">Your people.</span>{" "}
              <span className="whitespace-nowrap">Your work.</span>
              <span className="block text-accent">All in one place.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-text-muted sm:text-xl">
              Tasks, notes, reminders, calendars, clients, and teams. Everything connected in one simple workspace.{" "}
              <span className="text-text">Just type it or say it. Surfdesk keeps it organized.</span>
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <TrackedLink page={PAGE} cta="hero_primary" href={START} className={PRIMARY}>
                Get Started Free
              </TrackedLink>
              <TrackedLink page={PAGE} cta="hero_try" href="#try" className={SECONDARY}>
                Try it right now ↓
              </TrackedLink>
            </div>
            <p className="text-sm text-text-muted">7-day free trial · No card needed · Works on any phone or computer</p>
          </div>
          <ProductHero />
        </div>
      </section>

      {/* 2. Try it now: full-width dark band; the visitor uses the real command box before signing up. */}
      <section id="try" className="band relative scroll-mt-16 overflow-hidden">
        <Aurora tones={["var(--band-accent)", "var(--band-accent)", "var(--new)"]} strength={1.1} />
        <div className={`${WRAP} grid gap-10 py-20 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-start`}>
          <div className="space-y-5">
            <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: "var(--band-muted)" }}>
              <span className="flex items-center gap-1.5" style={{ color: "var(--band-accent)" }}>
                <span className="h-2 w-2 rounded-full motion-safe:animate-pulse" style={{ background: "var(--band-accent)" }} />
                Live
              </span>
              <span className="h-px w-10" style={{ background: "var(--band-accent)" }} aria-hidden />
              Try it now
            </p>
            <h2 className="font-display text-4xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
              Type anything.
              <span className="block" style={{ color: "var(--band-accent)" }}>
                Watch where it goes.
              </span>
            </h2>
            <p className="max-w-md text-lg leading-relaxed" style={{ color: "var(--band-muted)" }}>
              No sign-up. Type it the way you&apos;d say it: a reminder, a shopping list, a note about someone, a visit. Surfdesk files it in
              a second.
            </p>
          </div>
          <TryIt page={PAGE} signupHref={START} />
        </div>
      </section>

      {/* 3. Five apps fold into one (white). */}
      <AppFold />

      {/* 4. Graphs: the app's real Insights / Impact charts (sand, with color). */}
      <section className="relative overflow-hidden">
        <Aurora tones={["var(--accent)", "var(--new)", "var(--warn)"]} strength={0.8} />
        <div className={`${WRAP} space-y-10 py-20 sm:py-24`}>
          <div className="space-y-5">
            <Eyebrow>Insights and Impact</Eyebrow>
            <H2 accent="At a glance.">See how you&apos;re doing.</H2>
            <p className="max-w-2xl text-lg leading-relaxed text-text-muted">
              Every visit, check-in and task you log turns into clear numbers: who you served, what&apos;s growing and when you&apos;re busiest.
              No spreadsheets, no formulas.
            </p>
          </div>
          <InsightsShowcase page={PAGE} />
        </div>
      </section>

      {/* 5. Team chat (soft blue). */}
      <section className="relative overflow-hidden bg-accent-soft">
        <div className={`${WRAP} grid gap-10 py-20 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-center`}>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow>Team chat</Eyebrow>
              <span className="tag tag-v !ml-0">Team plans</span>
            </div>
            <H2 accent="right next to the work.">Talk as a team,</H2>
            <p className="max-w-md text-lg leading-relaxed text-text-muted">
              No more jumping between a group text, email and your client list. Your team&apos;s conversations live in Surfdesk, linked to the
              clients they&apos;re about.
            </p>
            <ul className="space-y-3">
              {CHAT_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-text">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-bg" aria-hidden>
                    ✓
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <TrackedLink page={PAGE} cta="chat_team_trial" href={TEAM} className={`inline-block ${PRIMARY}`}>
              Start a free team trial
            </TrackedLink>
          </div>
          <TeamChat />
        </div>
      </section>

      {/* 6. Built around you: audience switch, a day without and with Surfdesk (white). */}
      <section className="bg-bg-raised">
        <div className={`${WRAP} space-y-8 py-20 sm:py-24`}>
          <div className="space-y-5">
            <Eyebrow>Built around you</Eyebrow>
            <H2 accent="Here's what changes.">One workspace.</H2>
          </div>
          <AudienceExplorer page={PAGE} startHref={START} />
        </div>
      </section>

      {/* 7. Trust and pricing (sand, dot texture). */}
      <section id="pricing" className="relative scroll-mt-20 overflow-hidden">
        <div className="dots pointer-events-none absolute inset-0" aria-hidden />
        <div className={`${WRAP} space-y-8 py-20 sm:py-24`}>
          <div className="space-y-5">
            <Eyebrow>Pricing</Eyebrow>
            <H2 accent="Try it free first.">Simple pricing.</H2>
            <ul className="flex flex-wrap gap-2" aria-label="How we protect your data">
              {TRUST.map((t) => (
                <li key={t} className="rounded-full border border-border bg-bg-raised px-3 py-1.5 text-xs text-text">
                  <span className="text-accent">✓</span> {t}
                </li>
              ))}
            </ul>
          </div>
          <PlanCards
            page={PAGE}
            plans={["individual", "team", "organization", "enterprise"]}
            featured="team"
            swipe
            hrefs={{
              individual: { href: SOLO, label: "Start your free trial" },
              team: { href: TEAM, label: "Start your team trial" },
              organization: { href: TEAM, label: "Start your team trial" },
              enterprise: { href: SALES, label: "Contact sales" },
            }}
          />
        </div>
      </section>

      {/* 8. Close: deep surf-blue band, white text. */}
      <section className="cta-band relative overflow-hidden">
        <Aurora tones={["var(--cta-fg)", "var(--band-accent)", "var(--new)"]} strength={0.9} />
        <div className={`${WRAP} space-y-6 py-24 text-center sm:py-28`}>
          <h2 className="mx-auto max-w-3xl font-display text-5xl font-light leading-tight tracking-[-0.02em] sm:text-6xl">
            Make space for what matters.
          </h2>
          <div className="cta-muted mx-auto max-w-xl space-y-2 text-lg leading-relaxed">
            <p>Your day is already full. Keeping everything organized shouldn&apos;t make it harder.</p>
            <p>Bring it all together with Surfdesk.</p>
          </div>
          <div className="flex justify-center">
            <TrackedLink
              page={PAGE}
              cta="final_primary"
              href={START}
              className="cta-button rounded-full px-8 py-4 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Start Your Free Trial
            </TrackedLink>
          </div>
          <p className="cta-muted text-sm">7-day free trial · No card needed · Cancel any time</p>
          <p className="cta-muted pt-6 font-display text-sm font-light uppercase tracking-[0.25em]">Surfdesk. Keep everything moving.</p>
        </div>
      </section>
    </LandingShell>
  );
}
