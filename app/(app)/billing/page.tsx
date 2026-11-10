import Link from "next/link";
import { billingEnabled, getAccess, monthlyCost } from "@/lib/billing";
import { confirmCheckout, openBillingPortal, startCheckout } from "@/lib/actions/billing";

const ERRORS: Record<string, string> = {
  "not-set-up": "Billing isn't switched on yet. Nothing is charged until it is.",
  admin: "Only an organization admin can change the plan.",
};

const primary = "rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-bg hover:bg-accent-dim";
const secondary = "rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover";

function fmt(d: Date | string | null): string {
  return d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
}
function daysLeft(d: Date | null): number {
  return d ? Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000)) : 0;
}

const PLAN_NAMES: Record<string, string> = {
  individual: "Individual",
  seat: "Organization: per staff member",
  team: "Organization: Team",
  comp: "Free for life",
};

/** Settings → Billing: plan, trial and payment. Paying happens on Stripe's pages. */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ error?: string; checkout?: string }> }) {
  const { error, checkout } = await searchParams;
  if (checkout) await confirmCheckout(checkout).catch((err) => console.error("[billing] confirm failed", err));
  const a = await getAccess();
  const subscribed = Boolean(a.row?.stripe_subscription_id) && a.status !== "canceled";
  const isComp = a.plan === "comp";
  const seatCost = monthlyCost("seat", a.seats);
  const teamCost = monthlyCost("team", a.seats);
  const teamCheaper = teamCost < seatCost;

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">{a.scope === "org" ? a.orgName : "Settings"}</p>
        <h1 className="page-title">Billing</h1>
      </div>

      {error && ERRORS[error] && <p className="flag text-sm">{ERRORS[error]}</p>}
      {checkout && subscribed && <p className="text-sm text-accent">You&apos;re subscribed. Thank you!</p>}

      <section className="card space-y-2 p-5">
        <p className="eyebrow text-text-faint">Current plan</p>
        <p className="font-display text-2xl font-light">
          {isComp ? PLAN_NAMES.comp : subscribed && a.plan ? PLAN_NAMES[a.plan] : a.state === "trial" ? "Free trial" : "No plan"}
        </p>
        <p className="text-sm text-text-muted">
          {isComp && "Your account was here before billing started, so it's free for life. Nothing to do."}
          {!isComp && a.state === "trial" && `${daysLeft(a.endsAt)} days left, ends ${fmt(a.endsAt)}. Subscribe any time; you keep the free days.`}
          {!isComp && a.state === "ok" && subscribed && a.status === "trialing" && "Subscribed. Your first charge is when the free trial ends."}
          {!isComp && a.state === "ok" && subscribed && a.status === "active" && a.row?.current_period_end && `Renews ${fmt(a.row.current_period_end)}.`}
          {a.state === "grace" && `Your last payment didn't go through. Update your card by ${fmt(a.endsAt)} to keep full access.`}
          {a.state === "readonly" &&
            "Threads is view-only: you can see and export everything, but not add or edit. Subscribe to pick up where you left off."}
        </p>
        {a.scope === "org" && !isComp && (
          <p className="text-sm text-text-muted">
            {a.seats} active staff {a.seats === 1 ? "member" : "members"}. Billing updates automatically when staff join or leave.
          </p>
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
          {!billingEnabled() && <p className="text-sm text-text-muted">{ERRORS["not-set-up"]}</p>}
          {a.scope === "individual" ? (
            <form action={startCheckout} className="card space-y-3 p-5">
              <input type="hidden" name="plan" value="individual" />
              <p className="font-display text-2xl font-light">Individual</p>
              <p className="font-display text-4xl font-light tabular-nums">
                $5<span className="ml-1 font-sans text-base text-text-muted">/ month</span>
              </p>
              <p className="text-sm text-text-muted">Everything for one person. Cancel any time.</p>
              <button type="submit" className={primary} disabled={!billingEnabled()}>
                Subscribe
              </button>
            </form>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <form action={startCheckout} className="card flex flex-col gap-3 p-5" style={!teamCheaper ? { borderColor: "var(--accent)" } : undefined}>
                <input type="hidden" name="plan" value="seat" />
                <p className="font-display text-xl font-light">Per staff member</p>
                <p className="font-display text-3xl font-light tabular-nums">
                  $15<span className="ml-1 font-sans text-sm text-text-muted">/ staff / month</span>
                </p>
                <p className="flex-1 text-sm text-text-muted">
                  For your {a.seats}: <strong className="text-text tabular-nums">${seatCost}/month</strong>
                </p>
                {!teamCheaper && <span className="tag tag-n self-start">Best for your team</span>}
                <button type="submit" className={primary} disabled={!billingEnabled()}>
                  Choose per staff member
                </button>
              </form>
              <form action={startCheckout} className="card flex flex-col gap-3 p-5" style={teamCheaper ? { borderColor: "var(--accent)" } : undefined}>
                <input type="hidden" name="plan" value="team" />
                <p className="font-display text-xl font-light">Team</p>
                <p className="font-display text-3xl font-light tabular-nums">
                  $249<span className="ml-1 font-sans text-sm text-text-muted">/ month</span>
                </p>
                <p className="flex-1 text-sm text-text-muted">
                  20 staff included, $10 for each one after. For your {a.seats}:{" "}
                  <strong className="text-text tabular-nums">${teamCost}/month</strong>
                </p>
                {teamCheaper && <span className="tag tag-n self-start">Best for your team</span>}
                <button type="submit" className={primary} disabled={!billingEnabled()}>
                  Choose Team
                </button>
              </form>
            </div>
          )}
          <p className="text-xs text-text-faint">
            Payment is handled securely by Stripe. Have a promo code? Enter it on the payment page.
          </p>
        </section>
      )}

      {!a.canManage && !isComp && (
        <p className="text-sm text-text-muted">Your organization&apos;s admins handle billing.</p>
      )}

      <p className="text-xs text-text-faint">
        Questions? See the <Link href="/terms" className="underline">terms</Link>.
      </p>
    </div>
  );
}
