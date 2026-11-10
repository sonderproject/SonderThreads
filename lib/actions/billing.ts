"use server";

import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { appUrl } from "@/lib/email";
import {
  INDIVIDUAL_TRIAL_DAYS,
  activeSeats,
  customerFor,
  enforceOneTrialPerCard,
  getAccess,
  priceId,
  saveSubscription,
  stripe,
  type PaidPlan,
} from "@/lib/billing";

/** Settings → Billing → Subscribe: sends the person to Stripe Checkout. */
export async function startCheckout(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const s = stripe();
  if (!s) redirect("/billing?error=not-set-up");
  const access = await getAccess();
  if (!access.canManage) redirect("/billing?error=admin");
  const requested = formData.get("plan")?.toString() as PaidPlan;
  const plan: PaidPlan = access.scope === "individual" ? "individual" : requested === "team" ? "team" : "seat";

  const me = await queryOne<{ email: string; name: string | null }>(`select email, name from users where id = $1`, [userId]);
  const kind = access.scope === "org" ? "org" : "user";
  const ownerId = kind === "org" ? access.orgId! : userId;
  const customer = await customerFor(kind, ownerId, me?.email ?? "", kind === "org" ? access.orgName! : me?.name || me?.email || "");
  const quantity = kind === "org" ? await activeSeats(ownerId) : 1;

  // Organizations keep any free-trial days left (Stripe needs a trial end at least 2 days out).
  // Individuals start their 7-day trial here, with a card, the first time they subscribe.
  const trialEnd =
    kind === "org" && access.state === "trial" && access.endsAt && access.endsAt.getTime() - Date.now() > 2 * 86_400_000
      ? Math.floor(access.endsAt.getTime() / 1000)
      : undefined;
  const firstTrial = kind === "user" && !access.row?.stripe_subscription_id;
  const metadata = { kind, owner_id: ownerId, plan };

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: await priceId(plan), quantity }],
    subscription_data: {
      metadata,
      ...(trialEnd ? { trial_end: trialEnd } : {}),
      ...(firstTrial ? { trial_period_days: INDIVIDUAL_TRIAL_DAYS } : {}),
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
