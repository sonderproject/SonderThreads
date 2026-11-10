import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { saveSubscription, stripe } from "@/lib/billing";

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
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  try {
    const obj = event.data.object as { subscription?: string | { id: string } | null };
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await saveSubscription(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed":
      case "invoice.paid":
      case "invoice.payment_failed": {
        const id = typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id;
        if (id) await saveSubscription(await s.subscriptions.retrieve(id));
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    return NextResponse.json({ error: "Failed" }, { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
