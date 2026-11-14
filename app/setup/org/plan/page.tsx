import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { getMembership } from "@/lib/org";
import { billingEnabled, getAccess, ORG_TRIAL_DAYS, SKIP_TRIAL_OFFER } from "@/lib/billing";
import { calculateMonthlyPriceCents, formatCents, MAX_SELF_SERVE_SEATS, MIN_ORG_SEATS } from "@/lib/pricing";
import { startCheckout } from "@/lib/actions/billing";
import { SubmitButton } from "@/components/setup/SubmitButton";
import { SetupFrame } from "@/components/setup/SetupFrame";

export const metadata = { title: "Start · Surfdesk" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  seats: `Choose between ${MIN_ORG_SEATS} and ${MAX_SELF_SERVE_SEATS} seats. For more, contact us about Enterprise.`,
};

/** Organization set-up, step 5 of 7: the 14-day free trial (card on file), or 30% off and start today. */
export default async function SetupPlanPage({ searchParams }: { searchParams: Promise<{ offer?: string; error?: string }> }) {
  await requireUserId();
  const m = await getMembership();
  if (!m?.active || m.role !== "admin") redirect("/");
  const access = await getAccess();
  // Already started (or billing isn't set up here): on to the team.
  if (!billingEnabled() || access.state !== "setup") redirect("/setup/org/team");
  const { offer, error } = await searchParams;
  const org = await queryOne<{ planned_seats: number | null }>(`select planned_seats from organizations where id = $1`, [m.orgId]);
  const seats = Math.min(MAX_SELF_SERVE_SEATS, Math.max(MIN_ORG_SEATS, org?.planned_seats ?? 5));
  const monthly = calculateMonthlyPriceCents("organization", seats);
  const discounted = Math.round(monthly * (1 - SKIP_TRIAL_OFFER.percentOff / 100));
  const leadWithOffer = offer === "skip";

  const trialButton = (
    <SubmitButton key="trial" name="skip" value="0" pendingLabel="Opening secure checkout…" className={leadWithOffer ? secondary : primary}>
      Start my {ORG_TRIAL_DAYS}-day free trial
    </SubmitButton>
  );
  const offerButton = (
    <SubmitButton key="offer" name="skip" value="1" pendingLabel="Opening secure checkout…" className={leadWithOffer ? primary : secondary}>
      Skip the trial: {SKIP_TRIAL_OFFER.percentOff}% off your first month
    </SubmitButton>
  );

  return (
    <SetupFrame
      flow="org"
      step={5}
      signedIn
      title={`Start ${m.orgName}`}
      intro={`Pick your seats (one per staff member), then try it free for ${ORG_TRIAL_DAYS} days or start today with ${SKIP_TRIAL_OFFER.percentOff}% off.`}
    >
      <form action={startCheckout} className="space-y-5">
        <input type="hidden" name="from" value="setup" />
        {error && ERRORS[error] && <p role="alert" className="flag text-sm">{ERRORS[error]}</p>}
        <section className="card space-y-3 p-5">
          <label className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium text-text">Seats</span>
              <span className="block text-xs text-text-muted">Based on your team size. Change it any time in Billing.</span>
            </span>
            <input
              type="number"
              name="seats"
              min={MIN_ORG_SEATS}
              max={MAX_SELF_SERVE_SEATS}
              defaultValue={seats}
              required
              className="input w-24 text-center tabular-nums"
            />
          </label>
          <p className="text-sm text-text-muted">
            {seats} seats: <strong className="text-text tabular-nums">{formatCents(monthly)}/month</strong>. With the offer, your first month is{" "}
            <strong className="text-text tabular-nums">{formatCents(discounted)}</strong>. $19 a seat; 19–20 seats are $349 flat, then $15 per extra seat.
          </p>
        </section>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">{leadWithOffer ? [offerButton, trialButton] : [trialButton, offerButton]}</div>
          <ul className="space-y-1 text-xs text-text-muted">
            <li>
              Free trial: $0 today. Card required, one trial per card. You&apos;re charged after {ORG_TRIAL_DAYS} days unless you cancel in
              Billing.
            </li>
            <li>Skip the trial: pay today with {SKIP_TRIAL_OFFER.percentOff}% off your first month, then the regular price. Cancel any time.</li>
            <li>Payments are handled securely by Stripe.</li>
          </ul>
        </div>
      </form>
    </SetupFrame>
  );
}

const primary = "flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-bg hover:bg-accent-dim";
const secondary = "flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-bg-hover";
