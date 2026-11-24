import { SeatCalculator } from "@/components/billing/SeatCalculator";
import { EXTRA_SEAT_CENTS, INDIVIDUAL_CENTS, ORG_BASE_CENTS, ORG_INCLUDED_SEATS, SEAT_CENTS, SMALL_TEAM_MAX_SEATS } from "@/lib/pricing";
import { TrackedLink } from "./Track";

export type PlanKey = "individual" | "team" | "organization" | "enterprise";

const usd = (cents: number) => `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;

/** Prices come from lib/pricing.ts, the same numbers checkout charges. */
const PLANS: Record<PlanKey, { name: string; who: string; price: string; unit?: string; fine: string; features: string[] }> = {
  individual: {
    name: "Individual",
    who: "For one person.",
    price: usd(INDIVIDUAL_CENTS),
    unit: "/ month",
    fine: "7-day free trial. No card needed to start.",
    features: ["Your own private workspace", "Tasks, notes, lists and calendar", "Smart command box and voice", "Clients and follow-ups if you need them"],
  },
  team: {
    name: "Small Team",
    who: `For a business of one, or a team of up to ${SMALL_TEAM_MAX_SEATS}.`,
    price: usd(SEAT_CENTS),
    unit: "/ person / month",
    fine: "14-day free team trial.",
    features: ["Everything in Individual", "Smart forms, automations and scheduled reports", "Shared client list, team chat and roles", "One bill for the whole team"],
  },
  organization: {
    name: "Organization",
    who: `For ${SMALL_TEAM_MAX_SEATS + 1} people or more.`,
    price: usd(ORG_BASE_CENTS),
    unit: "/ month",
    fine: `${ORG_INCLUDED_SEATS} seats included. Each extra seat ${usd(EXTRA_SEAT_CENTS)}/month. 14-day free team trial.`,
    features: ["Everything in Small Team", "Team dashboard and activity log", "Branded PDF reports", "Onboarding help and data import"],
  },
  enterprise: {
    name: "Enterprise",
    who: "For large organizations with special needs.",
    price: "Custom",
    fine: "Tailored pricing, onboarding and terms.",
    features: ["Everything in Organization", "Guided onboarding and data import", "Custom setup", "Priority support"],
  },
};

export function PlanCards({
  page,
  plans,
  hrefs,
  featured,
  calculator = false,
  note = true,
  swipe = false,
}: {
  page: string;
  plans: PlanKey[];
  hrefs: Partial<Record<PlanKey, { href: string; label: string }>>;
  featured?: PlanKey;
  calculator?: boolean;
  /** The "skip the trial" line under the cards. */
  note?: boolean;
  /** Phones: plans scroll sideways instead of stacking (homepage). */
  swipe?: boolean;
}) {
  const cols = plans.length === 1 ? "max-w-md" : plans.length === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className="space-y-6">
      {swipe && <p className="text-xs text-text-muted sm:hidden">Swipe to compare plans →</p>}
      <div
        className={
          swipe
            ? `-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 ${cols}`
            : `grid gap-4 ${cols}`
        }
      >
        {plans.map((key) => {
          const p = PLANS[key];
          const link = hrefs[key];
          if (!link) return null;
          const on = key === featured;
          return (
            <div
              key={key}
              data-plan={key}
              className={`card flex flex-col gap-4 p-6 ${swipe ? "w-[82%] shrink-0 snap-center sm:w-auto" : ""}`}
              style={on ? { borderColor: "var(--accent)" } : undefined}
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-2xl font-light">{p.name}</h3>
                  {on && plans.length > 1 && <span className="tag tag-v whitespace-nowrap">Most popular</span>}
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
              <TrackedLink
                page={page}
                cta={key === "enterprise" ? "demo_enterprise" : `pricing_${key}`}
                href={link.href}
                className={
                  on
                    ? "rounded-full bg-accent px-6 py-3 text-center text-sm font-semibold text-bg hover:bg-accent-dim"
                    : "rounded-full border border-border bg-bg-raised px-6 py-3 text-center text-sm font-semibold hover:bg-bg-hover"
                }
              >
                {link.label}
              </TrackedLink>
            </div>
          );
        })}
      </div>
      {calculator && (
        <div className="card grid gap-6 p-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="space-y-2">
            <p className="section-label">Team price calculator</p>
            <h3 className="font-display text-2xl font-light">What will my team pay?</h3>
            <p className="text-sm text-text-muted">
              {usd(SEAT_CENTS)} a person up to {SMALL_TEAM_MAX_SEATS} people. From {SMALL_TEAM_MAX_SEATS + 1}, the {usd(ORG_BASE_CENTS)} Organization
              rate applies automatically because it&apos;s cheaper. You always get the lower price.
            </p>
          </div>
          <SeatCalculator initial={5} />
        </div>
      )}
      {note && <p className="text-xs text-text-muted">Skip the trial and get 30% off your first month. Cancel any time.</p>}
    </div>
  );
}
