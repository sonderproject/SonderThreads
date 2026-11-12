"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { appUrl } from "@/lib/email";
import { logEvent } from "@/lib/events";
import { toActionResult, type ActionResult } from "@/lib/validation";
import { MAX_SELF_SERVE_SEATS, MIN_ORG_SEATS, calculateMonthlyPriceCents, minimumSeats } from "@/lib/pricing";
import {
  INDIVIDUAL_TRIAL_DAYS,
  ORG_TRIAL_DAYS,
  customerFor,
  enforceOneTrialPerCard,
  getAccess,
  priceId,
  saveOfferCoupon,
  saveOfferEligible,
  saveSubscription,
  seatUsage,
  stripe,
  type PaidPlan,
} from "@/lib/billing";

/** Seats asked for, checked on the server: whole number, at least 2 and at least what's in use, at most the self-serve limit. */
function validSeats(raw: FormDataEntryValue | null | undefined, inUse: number): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < minimumSeats(inUse, 0) || n > MAX_SELF_SERVE_SEATS) return null;
  return n;
}

/** Settings → Billing → Subscribe: sends the person to Stripe Checkout. */
export async function startCheckout(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const s = stripe();
  if (!s) redirect("/billing?error=not-set-up");
  const access = await getAccess();
  if (!access.canManage) redirect("/billing?error=admin");
  // Organizations always get the seat-based plan; the price comes from lib/pricing.ts via the verified Stripe price.
  const plan: PaidPlan = access.scope === "individual" ? "individual" : "org";

  const me = await queryOne<{ email: string; name: string | null }>(`select email, name from users where id = $1`, [userId]);
  const kind = access.scope === "org" ? "org" : "user";
  const ownerId = kind === "org" ? access.orgId! : userId;
  const customer = await customerFor(kind, ownerId, me?.email ?? "", kind === "org" ? access.orgName! : me?.name || me?.email || "");
  let quantity = 1;
  if (kind === "org") {
    const u = await seatUsage(ownerId);
    const seats = validSeats(formData.get("seats"), u.active + u.pending);
    if (seats === null) redirect("/billing?error=seats");
    quantity = seats!;
  }

  // Organizations keep any free-trial days left (Stripe needs a trial end at least 2 days out).
  // Individuals start their 7-day trial here, with a card, the first time they subscribe.
  const trialEnd =
    kind === "org" && access.state === "trial" && access.endsAt && access.endsAt.getTime() - Date.now() > 2 * 86_400_000
      ? Math.floor(access.endsAt.getTime() / 1000)
      : undefined;
  // A first subscription starts the free trial: 7 days for individuals, 14 for organizations on card-first trials.
  const firstTrial = !access.row?.stripe_subscription_id && (kind === "user" || access.state === "setup");
  // card_trial marks a fresh card-first trial, which the one-trial-per-card check applies to.
  const metadata = { kind, owner_id: ownerId, plan, ...(firstTrial && !trialEnd ? { card_trial: "1" } : {}) };

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: await priceId(plan), quantity }],
    subscription_data: {
      metadata,
      ...(trialEnd ? { trial_end: trialEnd } : {}),
      ...(firstTrial && !trialEnd ? { trial_period_days: kind === "org" ? ORG_TRIAL_DAYS : INDIVIDUAL_TRIAL_DAYS } : {}),
    },
    payment_method_collection: "always",
    metadata,
    allow_promotion_codes: true,
    success_url: `${appUrl()}/billing?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/billing`,
  });
  redirect(session.url!);
}

/** After Checkout: save the subscription right away instead of waiting for the webhook. */
export async function confirmCheckout(sessionId: string): Promise<void> {
  const s = stripe();
  if (!s || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
  const access = await getAccess();
  const session = await s.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  const ownerId = access.scope === "org" ? access.orgId : await requireUserId();
  if (session.metadata?.owner_id !== ownerId) return; // someone else's checkout
  if (session.subscription && typeof session.subscription !== "string") {
    await saveSubscription(session.subscription);
    await enforceOneTrialPerCard(session.subscription);
  }
}

/** Settings → Billing → Manage: Stripe's billing portal (card, invoices, plan, cancel). */
export async function openBillingPortal(): Promise<void> {
  await requireUserId();
  const s = stripe();
  const access = await getAccess();
  if (!s || !access.canManage || !access.row?.stripe_customer_id) redirect("/billing");
  const portal = await s.billingPortal.sessions.create({
    customer: access.row!.stripe_customer_id!,
    return_url: `${appUrl()}/billing`,
  });
  redirect(portal.url);
}

/** The subscription this person may manage, or back to Settings. */
async function manageable() {
  await requireUserId();
  const s = stripe();
  const access = await getAccess();
  const subId = access.row?.stripe_subscription_id;
  if (!s || !access.canManage || !subId || access.plan === "comp") redirect("/settings#billing");
  return { s: s!, access, subId: subId! };
}

/** Settings → Subscription → Cancel: renewal turns off; access lasts until the paid period ends. */
export async function cancelSubscription(): Promise<void> {
  const { s, subId } = await manageable();
  await saveSubscription(await s.subscriptions.update(subId, { cancel_at_period_end: true }));
  revalidatePath("/", "layout");
  redirect("/settings?billing=canceled#billing");
}

/** Undo a cancel before the period ends. */
export async function resumeSubscription(): Promise<void> {
  const { s, subId } = await manageable();
  await saveSubscription(await s.subscriptions.update(subId, { cancel_at_period_end: false }));
  revalidatePath("/", "layout");
  redirect("/settings?billing=resumed#billing");
}

/** The cancel-flow offer: $5/month for 2 months instead of canceling. Once per account. */
export async function acceptSaveOffer(): Promise<void> {
  const { s, access, subId } = await manageable();
  if (!saveOfferEligible(access)) redirect("/settings#billing");
  // Claim the offer first so a double-click can't apply it twice.
  const claimed = await queryOne<{ id: string }>(
    `update billing_accounts set save_offer_used_at = now(), updated_at = now()
      where id = $1 and save_offer_used_at is null returning id`,
    [access.row!.id],
  );
  if (!claimed) redirect("/settings#billing");
  try {
    const coupon = await saveOfferCoupon();
    const sub = await s.subscriptions.update(subId, { discounts: [{ coupon }], cancel_at_period_end: false });
    await saveSubscription(sub);
  } catch (err) {
    console.error("[billing] save offer failed", err);
    await query(`update billing_accounts set save_offer_used_at = null where id = $1`, [access.row!.id]);
    redirect("/settings?billing=offer-failed#billing");
  }
  revalidatePath("/", "layout");
  redirect("/settings?billing=saved#billing");
}

/** Closes the post-checkout welcome screen for good (for this subscription). */
export async function finishWelcome(): Promise<void> {
  const access = await getAccess();
  const subId = access.row?.stripe_subscription_id;
  if (access.row && subId) {
    await query(`update billing_accounts set welcomed_subscription_id = $1, updated_at = now() where id = $2`, [
      subId,
      access.row.id,
    ]);
  }
  redirect("/");
}

export type SeatPreview = {
  seats: number;
  currentMonthlyCents: number;
  newMonthlyCents: number;
  /** Charged now for the rest of this month (more seats), or 0. */
  dueNowCents: number;
  /** Credit toward the next bill for the rest of this month (fewer seats), or 0. */
  creditCents: number;
  trialing: boolean;
};

/** The admin's organization subscription on the seat-based plan, or an error the page can show. */
async function orgSubscription() {
  await requireUserId();
  const s = stripe();
  const access = await getAccess();
  if (!s) throw new Error("Billing isn't switched on yet.");
  if (access.scope !== "org" || !access.canManage) throw new Error("Only an organization admin can change seats.");
  const row = access.row;
  if (!row?.stripe_subscription_id || row.plan !== "org" || row.status === "canceled") throw new Error("Choose a plan first.");
  const sub = await s.subscriptions.retrieve(row.stripe_subscription_id);
  const item = sub.items.data[0];
  if (!item) throw new Error("This subscription has no seats to change.");
  return { s, access, row, sub, item };
}

/** Billing → Change seats → Preview: exactly what Stripe will charge or credit, before anything changes. */
export async function previewSeatChange(seats: number): Promise<ActionResult<SeatPreview>> {
  return toActionResult(async () => {
    const { s, access, sub, item } = await orgSubscription();
    const u = await seatUsage(access.orgId!);
    const n = validSeats(String(seats), u.active + u.pending);
    if (n === null) throw new Error(seatRangeMessage(u.active + u.pending));
    const current = item.quantity ?? MIN_ORG_SEATS;
    const trialing = sub.status === "trialing";
    let dueNowCents = 0;
    let creditCents = 0;
    if (!trialing && n !== current) {
      const preview = await s.invoices.createPreview({
        customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        subscription: sub.id,
        subscription_details: {
          items: [{ id: item.id, quantity: n }],
          proration_behavior: "always_invoice",
          proration_date: Math.floor(Date.now() / 1000),
        },
      });
      const proration = preview.lines.data.filter((l) => l.proration).reduce((sum, l) => sum + l.amount, 0);
      if (proration > 0) dueNowCents = proration;
      else creditCents = -proration;
    }
    return {
      seats: n,
      currentMonthlyCents: calculateMonthlyPriceCents("organization", Math.max(MIN_ORG_SEATS, current)),
      newMonthlyCents: calculateMonthlyPriceCents("organization", n),
      dueNowCents,
      creditCents,
      trialing,
    };
  });
}

/**
 * Billing → Change seats → Confirm. More seats: the difference for the rest
 * of this month is charged now. Fewer seats: the difference is credited to
 * the next bill. Never below the seats in use (members + pending invites).
 */
export async function changeSeats(seats: number): Promise<ActionResult<{ seats: number }>> {
  return toActionResult(async () => {
    const { s, access, sub, item } = await orgSubscription();
    const u = await seatUsage(access.orgId!);
    const n = validSeats(String(seats), u.active + u.pending);
    if (n === null) throw new Error(seatRangeMessage(u.active + u.pending));
    const current = item.quantity ?? MIN_ORG_SEATS;
    if (n === current) return { seats: n };
    const updated = await s.subscriptions.update(sub.id, {
      items: [{ id: item.id, quantity: n }],
      proration_behavior: sub.status === "trialing" ? "none" : n > current ? "always_invoice" : "create_prorations",
      payment_behavior: "pending_if_incomplete",
    });
    await saveSubscription(updated);
    await logEvent("billing.seats_changed", `Seats ${current} → ${n} (${access.orgName})`, { meta: { subscription: sub.id, from: current, to: n } });
    revalidatePath("/", "layout");
    return { seats: n };
  });
}

function seatRangeMessage(inUse: number): string {
  const min = Math.max(MIN_ORG_SEATS, inUse);
  return `Choose between ${min} and ${MAX_SELF_SERVE_SEATS} seats${inUse > MIN_ORG_SEATS ? ` (${inUse} are in use by members and pending invites)` : ""}. For more, contact us about Enterprise.`;
}
