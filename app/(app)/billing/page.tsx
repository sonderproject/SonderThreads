import Link from "next/link";
import { LEGACY_ORG_PLANS, billingEnabled, getAccess, getFreshAccess, seatUsage } from "@/lib/billing";
import { MIN_ORG_SEATS, calculateMonthlyPriceCents, formatCents, orgTier } from "@/lib/pricing";
import { SeatCalculator } from "@/components/billing/SeatCalculator";
import { SeatManager } from "@/components/billing/SeatManager";
import { SUPPORT_EMAIL } from "@/lib/settings-options";
import { requireUserId } from "@/lib/current-user";
import { queryOne } from "@/lib/db/client";
import { SubscribedWelcome } from "@/components/billing/SubscribedWelcome";
import {
  confirmCheckout,
  openBillingPortal,
  startCheckout,
} from "@/lib/actions/billing";

const ERRORS: Record<string, string> = {
  "not-set-up":
    "Billing isn't switched on yet. Nothing is charged until it is.",
  admin: "Only an organization admin can change the plan.",
  seats: "Choose at least 2 seats, and at least as many as your members and pending invites. Over 500? Contact us about Enterprise.",
};

const primary =
  "rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-bg hover:bg-accent-dim";
const secondary =
  "rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover";

function fmt(d: Date | string | null): string {
  return d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
}
function daysLeft(d: Date | null): number {
  return d
    ? Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000))
    : 0;
}

const PLAN_NAMES: Record<string, string> = {
  individual: "Individual",
  org: "Organization",
  seat: "Organization: per staff member",
  team: "Organization: Team",
  comp: "Free for life",
};

/** Settings → Billing: plan, trial and payment. Paying happens on Stripe's pages. */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  const { error, checkout } = await searchParams;
  if (checkout)
    await confirmCheckout(checkout).catch((err) =>
      console.error("[billing] confirm failed", err),
    );
  // After Checkout, re-read: the cached access predates the subscription saved just above.
  const a = checkout ? await getFreshAccess() : await getAccess();
  const subscribed =
    Boolean(a.row?.stripe_subscription_id) && a.status !== "canceled";
  const isComp = a.plan === "comp";
  const usage = a.scope === "org" && a.orgId ? await seatUsage(a.orgId) : null;
  const inUse = usage ? usage.active + usage.pending : 1;
  const onSeatPlan = a.plan === "org" && subscribed;
  const legacyPlan = (LEGACY_ORG_PLANS as readonly string[]).includes(a.plan ?? "");
  const purchased = onSeatPlan ? Math.max(MIN_ORG_SEATS, a.row?.seats ?? MIN_ORG_SEATS) : null;
  const welcome =
    Boolean(checkout) && subscribed && a.row?.welcomed_subscription_id !== a.row?.stripe_subscription_id;
  const me = welcome
    ? await queryOne<{ name: string | null }>(`select name from users where id = $1`, [await requireUserId()])
    : null;
  const price =
    a.plan === "individual" ? "$9" : purchased ? formatCents(calculateMonthlyPriceCents("organization", purchased)) : null;

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">
          {a.scope === "org" ? a.orgName : "Settings"}
        </p>
        <h1 className="page-title">Billing</h1>
      </div>

      {error && ERRORS[error] && (
        <p className="flag text-sm">{ERRORS[error]}</p>
      )}
      {welcome && (
        <SubscribedWelcome
          firstName={me?.name?.trim().split(/\s+/)[0] || null}
          org={a.scope === "org" ? a.orgName : null}
          trialEnds={a.status === "trialing" ? fmt(a.row?.current_period_end ?? null) || null : null}
          price={price}
        />
      )}
      {checkout && subscribed && !welcome && (
        <p className="text-sm text-accent">
          You&apos;re subscribed. Thank you!
        </p>
      )}

      <section className="card space-y-2 p-5">
        <p className="eyebrow text-text-faint">Current plan</p>
        <p className="font-display text-2xl font-light">
          {isComp
            ? PLAN_NAMES.comp
            : subscribed && a.plan
              ? PLAN_NAMES[a.plan]
              : a.state === "trial"
                ? "Free trial"
                : a.state === "setup"
                  ? "Welcome to Strynd"
                  : "No plan"}
        </p>
        <p className="text-sm text-text-muted">
          {isComp &&
            "Your account was here before billing started, so it's free for life. Nothing to do."}
          {!isComp &&
            a.state === "trial" &&
            `${daysLeft(a.endsAt)} days left, ends ${fmt(a.endsAt)}. Subscribe any time; you keep the free days.`}
          {!isComp &&
            a.state === "ok" &&
            subscribed &&
            a.status === "trialing" &&
            "Subscribed. Your first charge is when the free trial ends."}
          {!isComp &&
            a.state === "ok" &&
            subscribed &&
            a.status === "active" &&
            a.row?.current_period_end &&
            `Renews ${fmt(a.row.current_period_end)}.`}
          {a.state === "grace" &&
            `Your last payment didn't go through. Update your card by ${fmt(a.endsAt)} to keep full access.`}
          {a.state === "setup" &&
            "Start your 7-day free trial to begin. You won't be charged today, and you can cancel any time before the trial ends."}
          {a.state === "readonly" &&
            "Strynd is view-only: you can see and export everything, but not add or edit. Subscribe to pick up where you left off."}
        </p>
        {a.scope === "org" && !isComp && usage && purchased && (
          <div className="space-y-1 pt-1 text-sm">
            <p className="text-text">
              <span className="tabular-nums">{inUse}</span> of <span className="tabular-nums">{purchased}</span> seats in use
              <span className="text-text-muted">
                {" "}
                ({usage.active} {usage.active === 1 ? "member" : "members"}
                {usage.pending ? `, ${usage.pending} pending ${usage.pending === 1 ? "invite" : "invites"}` : ""})
              </span>
            </p>
            <div className="progress-bar" aria-hidden>
              <span style={{ width: `${Math.min(100, (inUse / purchased) * 100)}%` }} />
            </div>
            <p className="text-text-muted">
              {formatCents(calculateMonthlyPriceCents("organization", purchased))} / month ·{" "}
              {orgTier(purchased) === "small_team" ? "Small Team: $19 a seat" : "Organization rate: $349 for 20 seats, $15 each after"}
            </p>
          </div>
        )}
        {a.scope === "org" && !isComp && legacyPlan && subscribed && (
          <p className="text-sm text-text-muted">
            {usage?.active ?? a.seats} active staff {(usage?.active ?? a.seats) === 1 ? "member" : "members"}. Your plan
            bills per active member and updates automatically when staff join or leave.
          </p>
        )}
        {a.scope === "org" && !isComp && !subscribed && usage && (
          <p className="text-sm text-text-muted">
            {usage.active} {usage.active === 1 ? "member" : "members"}
            {usage.pending ? ` and ${usage.pending} pending ${usage.pending === 1 ? "invite" : "invites"}` : ""}.
          </p>
        )}
        {onSeatPlan && a.canManage && purchased && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="eyebrow text-text-faint">Change seats</p>
            <SeatManager purchased={purchased} inUse={inUse} />
          </div>
        )}
        {subscribed && a.canManage && !isComp && (
          <form action={openBillingPortal} className="pt-2">
            <button type="submit" className={secondary}>
              Manage billing (card, invoices, cancel)
            </button>
          </form>
        )}
      </section>

      {!isComp && !subscribed && a.canManage && (
        <section className="space-y-3">
          <h2 className="section-label">Choose a plan</h2>
          {!billingEnabled() && (
            <p className="text-sm text-text-muted">{ERRORS["not-set-up"]}</p>
          )}
          {a.scope === "individual" ? (
            <>
              <form action={startCheckout} className="card space-y-3 p-5">
                <input type="hidden" name="plan" value="individual" />
                <p className="font-display text-2xl font-light">Individual</p>
                <p className="font-display text-4xl font-light tabular-nums">
                  $9
                  <span className="ml-1 font-sans text-base text-text-muted">
                    / month
                  </span>
                </p>
                <p className="text-sm text-text-muted">
                  {a.state === "setup"
                    ? "$0 today. After 7 days, $9 a month. Cancel any time before then and you won't be charged. One free trial per card."
                    : "Everything for one person. Cancel any time."}
                </p>
                <button
                  type="submit"
                  className={primary}
                  disabled={!billingEnabled()}
                >
                  {a.state === "setup" ? "Start my free trial" : "Subscribe"}
                </button>
                <p className="text-xs text-text-muted">
                  {a.state === "setup"
                    ? "Your plan renews automatically: after the 7-day free trial you're charged $9 every month until you cancel."
                    : "Your plan renews automatically: you're charged $9 every month until you cancel."}{" "}
                  Cancel any time in Settings → Subscription; you keep access until the end of the month you paid for. By
                  continuing you agree to the{" "}
                  <Link href="/terms#fees" className="text-accent hover:underline">
                    Terms of service
                  </Link>
                  .
                </p>
              </form>
              {a.state === "setup" && (
                <p className="text-sm text-text-muted">
                  Setting up for a team or agency?{" "}
                  <Link
                    href="/organization/new"
                    className="text-accent hover:underline"
                  >
                    Create an organization
                  </Link>{" "}
                  instead: 14 days free for your whole team.
                </p>
              )}
            </>
          ) : (
            <>
              <form action={startCheckout} className="card space-y-4 p-5">
                <div>
                  <p className="font-display text-2xl font-light">Team plan</p>
                  {a.state === "setup" && (
                    <p className="mt-1 text-sm text-text">
                      $0 today. Your 14-day free trial starts now, and you&apos;re only charged for your seats after it ends.
                      Cancel any time before then and you won&apos;t be charged. One free trial per card.
                    </p>
                  )}
                  <p className="mt-1 text-sm text-text-muted">
                    $19 a seat for 2–18 people. At 19 or more, the $349 Organization rate (20 seats included, $15 for each
                    extra seat) applies automatically, whichever is cheaper.
                  </p>
                </div>
                <SeatCalculator name="seats" min={Math.max(MIN_ORG_SEATS, inUse)} initial={Math.max(MIN_ORG_SEATS, inUse)} />
                <p className="text-xs text-text-muted">
                  You need at least {Math.max(MIN_ORG_SEATS, inUse)} seats for your current members and pending invites. Add
                  or remove seats any time; changes are prorated.
                  {a.state === "trial" && a.endsAt ? ` Your free trial continues until ${fmt(a.endsAt)}; you won't be charged before then.` : ""}
                </p>
                <button type="submit" className={primary} disabled={!billingEnabled()}>
                  {a.state === "setup" ? "Start the free trial" : "Continue to payment"}
                </button>
                <p className="text-xs text-text-muted">
                  The plan renews automatically every month at the price shown for your seats (plus prorated changes when you
                  add or remove seats) until you cancel.
                  {a.state === "trial" || a.state === "setup" ? " Nothing is charged before your free trial ends." : ""} Cancel any time in Settings →
                  Subscription; you keep access until the end of the month you paid for. By continuing you agree to the{" "}
                  <Link href="/terms#fees" className="text-accent hover:underline">
                    Terms of service
                  </Link>
                  .
                </p>
              </form>
              <p className="text-sm text-text-muted">
                Over 500 people, or need custom onboarding or integrations?{" "}
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Strynd Enterprise")}`} className="text-accent hover:underline">
                  Contact sales about Enterprise
                </a>
                .
              </p>
            </>
          )}
          <p className="text-xs text-text-faint">
            Payment is handled securely by Stripe. Have a promo code? Enter it
            on the payment page.
          </p>
        </section>
      )}

      {!a.canManage && !isComp && (
        <p className="text-sm text-text-muted">
          Your organization&apos;s admins handle billing.
        </p>
      )}

      <p className="text-xs text-text-faint">
        Questions? See the{" "}
        <Link href="/terms" className="underline">
          terms
        </Link>
        .
      </p>
    </div>
  );
}
