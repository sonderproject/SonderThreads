import type { Metadata } from "next";
import { FinalCta } from "@/components/marketing/landing/Kit";
import { PlanCards } from "@/components/marketing/landing/PlanCards";
import { LandingShell } from "@/components/marketing/landing/Shell";
import { TrackedLink } from "@/components/marketing/landing/Track";
import { AppFold } from "@/components/marketing/v2/AppFold";
import { AudienceExplorer } from "@/components/marketing/v2/AudienceExplorer";
import { ProductHero } from "@/components/marketing/v2/ProductHero";
import { StickyCta } from "@/components/marketing/v2/StickyCta";
import { TryIt } from "@/components/marketing/v2/TryIt";
import { landingHref } from "@/lib/landing";
import { SUPPORT_EMAIL } from "@/lib/settings-options";

/**
 * Homepage candidate (Nov 23, 2026): product-first hero, a working "try it now" command box,
 * the five-apps-into-one animation, an audience switch with money calculators, shorter overall.
 * Hidden from search and unlinked until the owner decides whether it replaces /welcome.
 */
export const metadata: Metadata = {
  title: { absolute: "Surfdesk | Tasks, Notes, Clients & Teams in One App" },
  description:
    "Organize your tasks, notes, reminders, calendar, clients, and team in one simple workspace. Surfdesk keeps everything connected.",
  robots: { index: false, follow: false },
};

/** The calendar in the hero shows today; refresh the page hourly. */
export const revalidate = 3600;

const PAGE = "home" as const;
const START = landingHref("/get-started", PAGE);
const SOLO = landingHref("/get-started/solo", PAGE);
const TEAM = landingHref("/get-started/org", PAGE);
const SALES = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Surfdesk Enterprise")}`;

const PRIMARY =
  "rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-bg shadow-sm ring-1 ring-inset ring-white/15 transition-colors hover:bg-accent-dim";
const SECONDARY = "rounded-full border border-border bg-bg-raised px-7 py-3.5 text-sm font-semibold text-text transition-colors hover:bg-bg-hover";

const TRUST = ["Encrypted in transit and at rest", "Two-step sign-in", "Roles and permissions", "Every account walled off", "Export everything, any time", "Never sold"];

export default function HomeV2() {
  return (
    <LandingShell
      page={PAGE}
      title="Surfdesk | Tasks, Notes, Clients & Teams in One App"
      description="Organize your tasks, notes, reminders, calendar, clients, and team in one simple workspace."
      primary={{ href: START, label: "Get Started Free", short: "Get started" }}
      after={<StickyCta page={PAGE} href={START} />}
    >
      {/* 1. Hero: the promise, then the product, big. */}
      <section className="space-y-10 pb-8 pt-14 text-center sm:pt-20">
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
      </section>

      {/* 2. Try it now: the visitor uses the real command box before signing up. */}
      <section id="try" className="band relative -mx-4 scroll-mt-16 overflow-hidden rounded-none px-4 py-20 sm:mx-0 sm:rounded-[32px] sm:px-12 sm:py-24">
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--band-accent) 22%, transparent)" }}
          aria-hidden
        />
        <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-5">
            <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: "var(--band-muted)" }}>
              <span style={{ color: "var(--band-accent)" }}>Live</span>
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

      {/* 3. Five apps fold into one. */}
      <AppFold />

      {/* 4. Built around you: audience switch with money calculators. */}
      <section className="space-y-8 border-t border-border py-20">
        <div className="space-y-5">
          <p className="eyebrow text-text-faint">Built around you</p>
          <h2 className="max-w-3xl font-display text-4xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
            One workspace. <span className="text-accent">See what it&apos;s worth to you.</span>
          </h2>
        </div>
        <AudienceExplorer page={PAGE} />
      </section>

      {/* 5. Trust and pricing, compact. */}
      <section id="pricing" className="scroll-mt-20 space-y-8 border-t border-border py-20">
        <div className="space-y-5">
          <p className="eyebrow text-text-faint">Pricing</p>
          <h2 className="max-w-3xl font-display text-4xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
            Simple pricing. <span className="text-accent">Try it free first.</span>
          </h2>
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
          calculator
          hrefs={{
            individual: { href: SOLO, label: "Start your free trial" },
            team: { href: TEAM, label: "Start your team trial" },
            organization: { href: TEAM, label: "Start your team trial" },
            enterprise: { href: SALES, label: "Contact sales" },
          }}
        />
      </section>

      {/* 6. Close. */}
      <FinalCta
        page={PAGE}
        title="Make space for"
        accent="what matters."
        body={["Your day is already full. Keeping everything organized shouldn't make it harder.", "Bring it all together with Surfdesk."]}
        primary={{ href: START, label: "Start Your Free Trial", cta: "final_primary" }}
        fine="7-day free trial · No card needed · Cancel any time"
      />
    </LandingShell>
  );
}
