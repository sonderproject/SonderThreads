import Link from "next/link";
import type Stripe from "stripe";
import { billingEnabled, getAccess, saveOfferEligible, stripe } from "@/lib/billing";
import { openBillingPortal, resumeSubscription } from "@/lib/actions/billing";
import { CancelSubscriptionButton } from "@/components/billing/CancelSubscriptionButton";

const PLAN_NAMES: Record<string, string> = {
  individual: "Individual",
  org: "Organization",
  seat: "Organization: per staff member",
  team: "Organization: Team",
};

const MESSAGES: Record<string, string> = {
  canceled: "Your subscription is canceled. You keep full access until the date below, and you won't be charged again.",
  resumed: "Welcome back. Your subscription will renew as usual.",
  saved: "Done. You'll pay $5 a month for your next 2 months, then $9. Thank you for staying.",
  "offer-failed": "We couldn't apply the offer just now. Nothing changed; please try again.",
};

const button = "rounded-full border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover";

function fmt(unix: number | null | undefined): string {
  return unix
    ? new Date(unix * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
}
function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

/** Live details from Stripe for the card; null if Stripe can't be reached. */
async function details(subId: string) {
  const s = stripe();
  if (!s) return null;
  try {
    const sub: Stripe.Subscription = await s.subscriptions.retrieve(subId, { expand: ["discounts"] });
    let next: number | null = null;
    if (!sub.cancel_at_period_end && sub.status !== "canceled") {
      try {
        next = (await s.invoices.createPreview({ subscription: sub.id })).amount_due;
      } catch {
        const item = sub.items.data[0];
        next = (item?.price.unit_amount ?? 0) * (item?.quantity ?? 1);
      }
    }
    const discount = (sub.discounts ?? []).find((d): d is Stripe.Discount => typeof d !== "string" && Boolean(d.end));
    return {
      status: sub.status,
      canceling: sub.cancel_at_period_end,
      trialEnd: sub.trial_end,
      periodEnd: sub.current_period_end,
      next,
      discountEnd: discount?.end ?? null,
    };
  } catch (err) {
    console.error("[billing] subscription details failed", err);
    return null;
  }
}

/** Settings → Subscription: plan, next charge, card and invoices, and a plain Cancel button. */
export async function ManageSubscriptionCard({ message }: { message?: string }) {
  const a = await getAccess();
  const row = a.row;
  const note = message && MESSAGES[message];

  if (a.plan === "comp") {
    return (
      <div className="card space-y-1 p-4">
        <p className="text-sm font-semibold text-text">Free for life</p>
        <p className="text-sm text-text-muted">Your account was here before billing started, so there's nothing to pay or cancel.</p>
      </div>
    );
  }
  if (!a.canManage) {
    return (
      <div className="card p-4">
        <p className="text-sm text-text-muted">{a.orgName ? `${a.orgName}'s` : "Your organization's"} admins handle billing.</p>
      </div>
    );
  }
  if (!billingEnabled() || !row?.stripe_subscription_id || row.status === "canceled") {
    return (
      <Link href="/billing" className="card flex items-center justify-between gap-3 p-4 hover:bg-bg-hover">
        <span className="text-sm text-text">{a.state === "trial" ? "Free trial: choose a plan" : "No active subscription"}</span>
        <span className="text-sm text-accent">Choose a plan →</span>
      </Link>
    );
  }

  const d = await details(row.stripe_subscription_id);
  const canceling = d?.canceling ?? row.cancel_at_period_end;
  const endUnix = d?.periodEnd ?? (row.current_period_end ? Date.parse(row.current_period_end) / 1000 : null);
  const trialing = (d?.status ?? row.status) === "trialing";
  const pastDue = a.state === "grace";

  return (
    <div className="space-y-3">
      {note && <p className={message === "offer-failed" ? "flag text-sm" : "text-sm text-accent"}>{note}</p>}
      <div className="card space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="eyebrow text-text-faint">Your plan</p>
            <p className="font-display text-xl font-light text-text">{PLAN_NAMES[row.plan] ?? "Subscription"}</p>
          </div>
          <span className={`tag shrink-0 ${canceling ? "tag-u" : pastDue ? "tag-e" : "tag-v"}`}>
            {canceling ? "Canceled" : pastDue ? "Payment failed" : trialing ? "Free trial" : "Active"}
          </span>
        </div>

        <p className="text-sm text-text-muted">
          {canceling &&
            `You keep full access until ${fmt(endUnix)}. You won't be charged again.`}
          {!canceling && pastDue && "Your last payment didn't go through. Update your card to keep full access."}
          {!canceling && !pastDue && trialing &&
            `Free trial until ${fmt(d?.trialEnd ?? endUnix)}. ${d?.next != null ? `Your first charge is ${money(d.next)} that day.` : ""}`}
          {!canceling && !pastDue && !trialing &&
            (d?.next != null ? `Next charge: ${money(d.next)} on ${fmt(endUnix)}.` : `Renews ${fmt(endUnix)}.`)}
        </p>
        {!canceling && d?.discountEnd && (
          <p className="text-sm text-text-muted">
            <span className="tag tag-n mr-2">$5 / month</span>
            Your discount runs until {fmt(d.discountEnd)}.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <form action={openBillingPortal}>
            <button type="submit" className={button}>
              {pastDue ? "Update card" : "Card and invoices"}
            </button>
          </form>
          {canceling ? (
            <form action={resumeSubscription}>
              <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
                Resume subscription
              </button>
            </form>
          ) : (
            <CancelSubscriptionButton offer={saveOfferEligible(a)} accessUntil={fmt(endUnix)} trialing={trialing} />
          )}
        </div>
      </div>
    </div>
  );
}
