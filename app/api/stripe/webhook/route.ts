import { NextResponse } from "next/server";
import { sendPaymentFailedEmail } from "@/lib/lifecycle";
import type Stripe from "stripe";
import { enforceOneTrialPerCard, saveSubscription, stripe } from "@/lib/billing";
import { alertOwner, logEvent } from "@/lib/events";

export const runtime = "nodejs";

/** Stripe → billing_accounts. Signed with STRIPE_WEBHOOK_SECRET; everything else is rejected. */
export async function POST(request: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    await logEvent("stripe.bad_signature", "Stripe webhook signature check failed", { level: "error", path: "/api/stripe/webhook" });
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  try {
    const obj = event.data.object as { subscription?: string | { id: string } | null };
    switch (event.type) {
      case "customer.subscription.created":
        await saveSubscription(event.data.object as Stripe.Subscription);
        await enforceOneTrialPerCard(event.data.object as Stripe.Subscription);
        await notifySubscription(s, event);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await saveSubscription(event.data.object as Stripe.Subscription);
        await notifySubscription(s, event);
        break;
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const amount = `$${((inv.amount_due ?? 0) / 100).toFixed(2)}`;
        await logEvent("billing.payment_failed", `Payment of ${amount} failed`, { level: "error", email: inv.customer_email, meta: { invoice: inv.id } });
        await alertOwner("A payment failed", [`${inv.customer_email ?? "A customer"}'s payment of ${amount} didn't go through.`, "Stripe retries automatically; they keep full access for 14 days."], { key: `payfail:${inv.id}` });
        const id = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        if (id) await saveSubscription(await s.subscriptions.retrieve(id));
        // Tell the person who pays (once per invoice), so they can fix the card before access is limited.
        const customer = typeof inv.customer === "string" ? inv.customer : (inv.customer?.id ?? null);
        if (inv.id) await sendPaymentFailedEmail(inv.id, customer, amount).catch((err) => console.error("[stripe webhook] payment-failed email", err));
        break;
      }
      case "checkout.session.completed":
      case "invoice.paid": {
        const id = typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id;
        if (id) await saveSubscription(await s.subscriptions.retrieve(id));
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    await logEvent("stripe.webhook_failed", `${event.type}: ${err instanceof Error ? err.message : String(err)}`, { level: "error", path: "/api/stripe/webhook", meta: { event: event.id } });
    return NextResponse.json({ error: "Failed" }, { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}

/** New subscribers and cancellations: logged, and the good news emailed to the owner. */
async function notifySubscription(s: Stripe, event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const prev = (event.data.previous_attributes ?? {}) as Partial<Stripe.Subscription>;
  let email: string | null = null;
  try {
    const c = await s.customers.retrieve(typeof sub.customer === "string" ? sub.customer : sub.customer.id);
    email = "email" in c ? (c.email ?? null) : null;
  } catch {
    // fine without it
  }
  const who = email ?? "A customer";
  const plan = sub.metadata?.plan ?? "plan";
  if (event.type === "customer.subscription.created") {
    const trial = sub.status === "trialing";
    await logEvent("billing.subscribed", `${trial ? "Started a free trial" : "Subscribed"} (${plan})`, { email, meta: { subscription: sub.id } });
    await alertOwner(trial ? "New free trial" : "New paying customer", [`${who} ${trial ? "started a free trial" : "subscribed"} on the ${plan} plan.`], { key: `sub:${sub.id}` });
  } else if (event.type === "customer.subscription.updated" && prev.status === "trialing" && sub.status === "active") {
    await logEvent("billing.converted", `Trial turned into a paid subscription (${plan})`, { email, meta: { subscription: sub.id } });
    await alertOwner("A trial just converted", [`${who}'s free trial ended and their first payment went through.`], { key: `paid:${sub.id}` });
  } else if (event.type === "customer.subscription.updated" && "cancel_at_period_end" in prev && sub.cancel_at_period_end) {
    await logEvent("billing.canceled", `Canceled; access until the period ends (${plan})`, { level: "warn", email, meta: { subscription: sub.id } });
  } else if (event.type === "customer.subscription.deleted") {
    await logEvent("billing.ended", `Subscription ended (${plan})`, { level: "warn", email, meta: { subscription: sub.id } });
  }
}
