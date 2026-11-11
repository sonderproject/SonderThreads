import { cache } from "react";
import Stripe from "stripe";
import { query, queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";

/**
 * Billing. Individuals: $9/month after a 7-day free trial. Organizations:
 * $15 per staff member, or Team ($249/month with 20 staff included, $10 each
 * after), after a 30-day free trial. Accounts that existed before billing
 * started are "comp" (free for life). When a trial ends or payment fails for
 * more than 14 days, the account turns view-only: everything stays visible and
 * exportable, nothing can be added or changed. Nothing is enforced until
 * STRIPE_SECRET_KEY is set.
 */

export const INDIVIDUAL_TRIAL_DAYS = 7;
export const ORG_TRIAL_DAYS = 30;
export const GRACE_DAYS = 14;
export const PRICES = {
  individual: "threads_individual_monthly",
  seat: "threads_org_seat_monthly",
  team: "threads_org_team_monthly",
} as const;
export type PaidPlan = keyof typeof PRICES;

/** What each plan costs a month for `seats` staff (in dollars). */
export function monthlyCost(plan: "seat" | "team", seats: number): number {
  return plan === "seat" ? 15 * seats : 249 + 10 * Math.max(0, seats - 20);
}

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}
export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

const priceIds = new Map<string, string>();
export async function priceId(plan: PaidPlan): Promise<string> {
  const key = PRICES[plan];
  const hit = priceIds.get(key);
  if (hit) return hit;
  const s = stripe();
  if (!s) throw new Error("Billing isn't set up yet.");
  const res = await s.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const id = res.data[0]?.id;
  if (!id) throw new Error(`Stripe price ${key} not found.`);
  priceIds.set(key, id);
  return id;
}

export type BillingRow = {
  id: string;
  user_id: string | null;
  org_id: string | null;
  plan: "individual" | "seat" | "team" | "comp";
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  seats: number | null;
  current_period_end: string | null;
  past_due_since: string | null;
  cancel_at_period_end: boolean;
  save_offer_used_at: string | null;
  welcomed_subscription_id: string | null;
};

export type Access = {
  /**
   * ok: full use · trial: full use, free trial running · grace: payment failed, still full use ·
   * readonly: view-only · setup: new individual who hasn't started their trial (card first) yet
   */
  state: "ok" | "trial" | "grace" | "readonly" | "setup";
  scope: "individual" | "org";
  orgId: string | null;
  orgName: string | null;
  /** Can this person pay or change the plan? (Individuals, and organization admins.) */
  canManage: boolean;
  plan: BillingRow["plan"] | null;
  status: string | null;
  /** Trial end, or the end of the grace period. */
  endsAt: Date | null;
  seats: number;
  row: BillingRow | null;
};

const DAY = 86_400_000;

async function computeAccess(userId: string): Promise<Access> {
  const m = await queryOne<{ org_id: string; role: string; name: string; org_created: string }>(
    `select m.org_id, m.role, o.name, o.created_at as org_created
       from memberships m join organizations o on o.id = m.org_id
      where m.user_id = $1 and m.active limit 1`,
    [userId],
  );
  if (m) {
    const [row, seats] = await Promise.all([
      queryOne<BillingRow>(`select * from billing_accounts where org_id = $1`, [m.org_id]),
      activeSeats(m.org_id),
    ]);
    const trialEnd = new Date(new Date(m.org_created).getTime() + ORG_TRIAL_DAYS * DAY);
    return { ...decide(row, trialEnd), scope: "org", orgId: m.org_id, orgName: m.name, canManage: m.role === "admin", seats, row };
  }
  const [row, invited] = await Promise.all([
    queryOne<BillingRow>(`select * from billing_accounts where user_id = $1`, [userId]),
    // Someone invited to an organization joins it instead of starting a personal trial.
    queryOne(
      `select 1 from invitations i join users u on lower(u.email) = lower(i.email)
        where u.id = $1 and i.accepted_at is null and i.expires_at > now() limit 1`,
      [userId],
    ),
  ]);
  const base = { scope: "individual" as const, orgId: null, orgName: null, canManage: true, seats: 1, row };
  if (invited && !row?.stripe_subscription_id && row?.plan !== "comp") {
    return { ...base, state: "ok", plan: row?.plan ?? null, status: row?.status ?? null, endsAt: null };
  }
  // Individuals start their 7-day trial with a card on Stripe, so no subscription yet means "set up first".
  const decided = decide(row, new Date(0));
  if (decided.state === "readonly" && !row?.stripe_subscription_id) return { ...base, ...decided, state: "setup" };
  return { ...base, ...decided };
}

function decide(row: BillingRow | null, trialEnd: Date): Pick<Access, "state" | "plan" | "status" | "endsAt"> {
  const plan = row?.plan ?? null;
  const status = row?.status ?? null;
  if (plan === "comp" || status === "comp") return { state: "ok", plan, status, endsAt: null };
  if (status === "active") return { state: "ok", plan, status, endsAt: null };
  if (status === "trialing" && row?.stripe_subscription_id) return { state: "ok", plan, status, endsAt: null };
  if ((status === "past_due" || status === "unpaid") && row?.past_due_since) {
    const graceEnd = new Date(new Date(row.past_due_since).getTime() + GRACE_DAYS * DAY);
    if (graceEnd > new Date()) return { state: "grace", plan, status, endsAt: graceEnd };
    return { state: "readonly", plan, status, endsAt: graceEnd };
  }
  // No paid subscription (never subscribed, or canceled): the free trial decides.
  if (trialEnd > new Date()) return { state: "trial", plan, status, endsAt: trialEnd };
  return { state: "readonly", plan, status, endsAt: trialEnd };
}

/** This person's access, once per request. Everyone has full access until Stripe is configured. */
export const getAccess = cache(async (): Promise<Access> => {
  const userId = await requireUserId();
  const access = await computeAccess(userId);
  if (!billingEnabled() && (access.state === "readonly" || access.state === "setup")) return { ...access, state: "ok" };
  return access;
});

/** Like getAccess, but read fresh, e.g. right after Checkout saved a new subscription in this same request. */
export async function getFreshAccess(): Promise<Access> {
  const access = await computeAccess(await requireUserId());
  if (!billingEnabled() && (access.state === "readonly" || access.state === "setup")) return { ...access, state: "ok" };
  return access;
}

export class ReadOnlyError extends Error {}

/** Every add/edit/delete calls this first. View-only accounts get a clear message instead. */
export async function assertCanWrite(): Promise<void> {
  const a = await getAccess();
  if (a.state !== "readonly" && a.state !== "setup") return;
  throw new ReadOnlyError(
    a.scope === "org" && !a.canManage
      ? `${a.orgName}'s subscription has ended, so Strynd is view-only. Ask your organization admin to renew it.`
      : "Your free trial has ended, so Strynd is view-only. Subscribe in Settings → Billing to keep adding and editing.",
  );
}

export async function activeSeats(orgId: string): Promise<number> {
  const r = await queryOne<{ n: number }>(`select count(*)::int as n from memberships where org_id = $1 and active`, [orgId]);
  return Math.max(1, r?.n ?? 1);
}

/** After staff join or leave: bill the organization for its current number of active staff. */
export async function syncOrgSeats(orgId: string): Promise<void> {
  const s = stripe();
  if (!s) return;
  const row = await queryOne<BillingRow>(`select * from billing_accounts where org_id = $1`, [orgId]);
  if (!row?.stripe_subscription_id || row.plan === "comp") return;
  try {
    const seats = await activeSeats(orgId);
    const sub = await s.subscriptions.retrieve(row.stripe_subscription_id);
    const item = sub.items.data[0];
    if (!item || item.quantity === seats || sub.status === "canceled") return;
    await s.subscriptions.update(sub.id, {
      items: [{ id: item.id, quantity: seats }],
      proration_behavior: "create_prorations",
    });
    await query(`update billing_accounts set seats = $1, updated_at = now() where id = $2`, [seats, row.id]);
  } catch (err) {
    console.error("[billing] seat sync failed", err);
  }
}

/** Mirrors a Stripe subscription into billing_accounts (from the webhook and after checkout). */
export async function saveSubscription(sub: Stripe.Subscription): Promise<void> {
  const kind = sub.metadata?.kind;
  const ownerId = sub.metadata?.owner_id;
  const plan = sub.metadata?.plan;
  if ((kind !== "user" && kind !== "org") || !ownerId || !plan || !(plan in PRICES)) return;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const status = sub.status;
  const seats = sub.items.data[0]?.quantity ?? null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const col = kind === "user" ? "user_id" : "org_id";
  const pastDue = status === "past_due" || status === "unpaid";
  await query(
    `insert into billing_accounts (${col}, plan, status, stripe_customer_id, stripe_subscription_id, seats, current_period_end, past_due_since, cancel_at_period_end)
     values ($1, $2, $3, $4, $5, $6, $7, case when $8 then now() end, $9)
     on conflict (${col}) do update set
       plan = case when billing_accounts.plan = 'comp' then 'comp' else excluded.plan end,
       status = case when billing_accounts.plan = 'comp' then 'comp' else excluded.status end,
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id,
       seats = excluded.seats,
       current_period_end = excluded.current_period_end,
       past_due_since = case when $8 then coalesce(billing_accounts.past_due_since, now()) end,
       cancel_at_period_end = excluded.cancel_at_period_end,
       updated_at = now()`,
    [ownerId, plan, status, customer, sub.id, seats, periodEnd, pastDue, Boolean(sub.cancel_at_period_end)],
  );
}

/** The Stripe customer for this account, created the first time someone subscribes. */
export async function customerFor(kind: "user" | "org", ownerId: string, email: string, name: string): Promise<string> {
  const s = stripe();
  if (!s) throw new Error("Billing isn't set up yet.");
  const col = kind === "user" ? "user_id" : "org_id";
  const row = await queryOne<{ stripe_customer_id: string | null }>(
    `select stripe_customer_id from billing_accounts where ${col} = $1`,
    [ownerId],
  );
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const c = await s.customers.create({ email, name, metadata: { kind, owner_id: ownerId, app: "threads" } });
  await query(
    `insert into billing_accounts (${col}, plan, status, stripe_customer_id) values ($1, $2, 'trialing', $3)
     on conflict (${col}) do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now()`,
    [ownerId, kind === "user" ? "individual" : "seat", c.id],
  );
  return c.id;
}

/**
 * One free trial per card: if a new individual trial uses a card that already
 * had one (under any account), the trial ends now and billing starts today.
 * Stripe gives every card number the same fingerprint, whatever email is used.
 */
export async function enforceOneTrialPerCard(sub: Stripe.Subscription): Promise<void> {
  const s = stripe();
  if (!s || sub.status !== "trialing" || sub.metadata?.kind !== "user") return;
  const pmId = typeof sub.default_payment_method === "string" ? sub.default_payment_method : sub.default_payment_method?.id;
  if (!pmId) return;
  const pm = await s.paymentMethods.retrieve(pmId);
  const fingerprint = pm.card?.fingerprint;
  if (!fingerprint) return;
  await query(
    `insert into trial_cards (fingerprint, user_id, subscription_id) values ($1, $2, $3) on conflict (fingerprint) do nothing`,
    [fingerprint, sub.metadata.owner_id, sub.id],
  );
  const first = await queryOne<{ subscription_id: string }>(`select subscription_id from trial_cards where fingerprint = $1`, [fingerprint]);
  if (first && first.subscription_id !== sub.id) {
    const ended = await s.subscriptions.update(sub.id, { trial_end: "now", proration_behavior: "none" });
    await saveSubscription(ended);
  }
}

/**
 * The cancel-flow offer: Individual drops from $9 to $5 a month for 2 months,
 * then goes back to $9. Offered once per account, ever. The coupon lives in
 * Stripe and is created the first time anyone accepts it.
 */
export const SAVE_OFFER = { couponId: "threads_save_5_for_2", monthly: 5, months: 2 } as const;

export async function saveOfferCoupon(): Promise<string> {
  const s = stripe();
  if (!s) throw new Error("Billing isn't set up yet.");
  try {
    return (await s.coupons.retrieve(SAVE_OFFER.couponId)).id;
  } catch {
    const c = await s.coupons.create({
      id: SAVE_OFFER.couponId,
      name: "Stay for $5/month",
      amount_off: 400,
      currency: "usd",
      duration: "repeating",
      duration_in_months: SAVE_OFFER.months,
    });
    return c.id;
  }
}

/** Can this account still get the "$5 for 2 months" offer when it cancels? */
export function saveOfferEligible(a: Access): boolean {
  const r = a.row;
  return (
    a.scope === "individual" &&
    r?.plan === "individual" &&
    Boolean(r.stripe_subscription_id) &&
    (r.status === "active" || r.status === "trialing") &&
    !r.save_offer_used_at
  );
}
