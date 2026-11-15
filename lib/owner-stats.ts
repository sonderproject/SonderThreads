import type Stripe from "stripe";
import { query, queryOne } from "@/lib/db/client";
import { stripe } from "@/lib/billing";

/*
 * Numbers for the owner command center (callers must have passed requireOwner()).
 * Counts, plans and dates only: never the contents of anyone's client records,
 * notes or tasks (privacy policy and the organizations' client-data terms).
 */

const ours = (meta: Stripe.Metadata | null | undefined) => meta?.kind === "user" || meta?.kind === "org";

/** Live money numbers from Stripe, limited to Surfdesk subscriptions (the account also sells other things). */
export async function stripeNumbers() {
  const s = stripe();
  if (!s) return null;
  try {
    const [subs, invoices, balance] = await Promise.all([
      s.subscriptions.list({ status: "active", limit: 100, expand: ["data.discounts"] }),
      s.invoices.list({ status: "paid", limit: 30 }),
      s.balance.retrieve(),
    ]);
    let mrr = 0;
    let count = 0;
    for (const sub of subs.data.filter((x) => ours(x.metadata))) {
      let amount = sub.items.data.reduce((sum, it) => sum + (it.price.unit_amount ?? 0) * (it.quantity ?? 1), 0);
      for (const d of sub.discounts ?? []) {
        if (typeof d === "string") continue;
        if (d.coupon.amount_off) amount -= d.coupon.amount_off;
        else if (d.coupon.percent_off) amount -= Math.round((amount * d.coupon.percent_off) / 100);
      }
      mrr += Math.max(0, amount);
      count++;
    }
    const charges = invoices.data
      .filter((i) => ours(i.subscription_details?.metadata) && i.amount_paid > 0)
      .slice(0, 8)
      .map((i) => ({ id: i.id, email: i.customer_email, amount: i.amount_paid, at: i.status_transitions.paid_at ?? i.created }));
    const available = balance.available.find((b) => b.currency === "usd")?.amount ?? 0;
    const pending = balance.pending.find((b) => b.currency === "usd")?.amount ?? 0;
    return { mrr, subscriptions: count, charges, available, pending };
  } catch (err) {
    console.error("[owner] stripe numbers failed", err);
    return null;
  }
}

/** Surfdesk revenue collected per month, last 3 months (paid invoices). */
export async function revenueByMonth(): Promise<{ month: string; cents: number }[] | null> {
  const s = stripe();
  if (!s) return null;
  try {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCMonth(since.getUTCMonth() - 2);
    since.setUTCHours(0, 0, 0, 0);
    const months = new Map<string, number>();
    for (let i = 0; i < 3; i++) {
      const d = new Date(since);
      d.setUTCMonth(since.getUTCMonth() + i);
      months.set(d.toISOString().slice(0, 7), 0);
    }
    let n = 0;
    for await (const inv of s.invoices.list({ status: "paid", created: { gte: Math.floor(since.getTime() / 1000) }, limit: 100 })) {
      if (++n > 1000) break;
      if (!ours(inv.subscription_details?.metadata) || inv.amount_paid <= 0) continue;
      const key = new Date((inv.status_transitions.paid_at ?? inv.created) * 1000).toISOString().slice(0, 7);
      if (months.has(key)) months.set(key, (months.get(key) ?? 0) + inv.amount_paid);
    }
    return [...months].map(([month, cents]) => ({ month, cents }));
  } catch (err) {
    console.error("[owner] revenue by month failed", err);
    return null;
  }
}

/** Card trials that finished (started 14–104 days ago) and how many turned into paid subscriptions. */
export async function trialConversion(): Promise<{ trials: number; converted: number }> {
  const r = await queryOne<{ trials: number; converted: number }>(
    `with t as (
       select distinct meta->>'subscription' as sub from app_events
        where kind = 'billing.subscribed' and message like 'Started a free trial%'
          and created_at between now() - interval '104 days' and now() - interval '14 days')
     select count(*)::int as trials,
            count(*) filter (where exists (select 1 from app_events c where c.kind = 'billing.converted' and c.meta->>'subscription' = t.sub))::int as converted
       from t`,
  );
  return { trials: r?.trials ?? 0, converted: r?.converted ?? 0 };
}

export type HealthRow = {
  kind: "individual" | "org";
  name: string;
  plan: string;
  status: string;
  seats: number | null;
  members: number;
  last_in: string | null;
  last_check_in: string | null;
};

/** Every paying or trialing customer, quietest first: nobody in for 7+ days = call them before they cancel. */
export async function customerHealth(): Promise<HealthRow[]> {
  return query<HealthRow>(
    `select * from (
       select 'individual' as kind, u.email as name, b.plan, b.status, b.seats, 1 as members,
              au.last_sign_in_at as last_in,
              (select max(c.created_at) from check_ins c where c.user_id = u.id) as last_check_in
         from billing_accounts b join users u on u.id = b.user_id left join auth.users au on au.id = u.id
        where b.status in ('active', 'trialing', 'past_due', 'unpaid') and b.stripe_subscription_id is not null
       union all
       select 'org', o.name, b.plan, b.status, b.seats,
              (select count(*)::int from memberships m where m.org_id = o.id and m.active),
              (select max(au.last_sign_in_at) from memberships m join auth.users au on au.id = m.user_id where m.org_id = o.id and m.active),
              (select max(c.created_at) from check_ins c join memberships m on m.user_id = c.user_id where m.org_id = o.id)
         from billing_accounts b join organizations o on o.id = b.org_id
        where b.status in ('active', 'trialing', 'past_due', 'unpaid') and b.stripe_subscription_id is not null
     ) x order by greatest(last_in, last_check_in) asc nulls first limit 200`,
  );
}

/** Referral links and what they bring in (counts only). */
export async function referralGrowth() {
  const [orgs, weeks, signups] = await Promise.all([
    queryOne<{ active: number; total: number }>(
      `select count(*) filter (where referral_enabled)::int as active, count(*)::int as total from organizations where suspended_at is null`,
    ),
    query<{ week: string; n: number }>(
      `select to_char(date_trunc('week', created_at), 'Mon DD') as week, count(*)::int as n
         from referrals where created_at > date_trunc('week', now()) - interval '7 weeks'
        group by date_trunc('week', created_at) order by date_trunc('week', created_at)`,
    ),
    queryOne<{ signups: number; paid: number }>(
      `select count(*)::int as signups,
              count(*) filter (where exists (
                select 1 from users u where lower(u.email) = lower(e.email)
                  and (exists (select 1 from billing_accounts b where b.user_id = u.id and b.stripe_subscription_id is not null)
                       or exists (select 1 from memberships m join billing_accounts b2 on b2.org_id = m.org_id
                                   where m.user_id = u.id and m.active and b2.stripe_subscription_id is not null))))::int as paid
         from app_events e where e.kind = 'auth.signup' and e.meta->>'utm_source' = 'referral' and e.message not ilike '%bot%'`,
    ),
  ]);
  return { orgs, weeks, signups };
}

/** Marketing list (lib/marketing.ts): opted in now, and the opt-in rate among sign-ups since the checkbox went live. */
export async function marketingList() {
  return queryOne<{ opted_in: number; since_launch: number; opted_at_signup: number }>(
    `select (select count(*)::int from users where marketing_opt_in and suspended_at is null) as opted_in,
            (select count(*)::int from users where created_at >= coalesce((select min(created_at) from marketing_consents), now())) as since_launch,
            (select count(distinct user_id)::int from marketing_consents where source = 'signup') as opted_at_signup`,
  );
}

/** Who signs up (90 days, real accounts): individuals by use, organizations by type and team size. */
export async function whoSignsUp() {
  const [types, uses, sizes, services, outcomes] = await Promise.all([
    query<{ label: string; n: number }>(
      `select case when o.id is null then 'Individual'
                   when o.created_by = u.id then case o.kind when 'business' then 'Business (created it)' else 'Nonprofit or agency (created it)' end
                   else 'Joined a team' end as label, count(*)::int as n
         from users u
         left join memberships m on m.user_id = u.id
         left join organizations o on o.id = m.org_id
        where u.created_at > now() - interval '90 days'
          and not (split_part(lower(u.email), '@', 2) in ('gmail.com', 'googlemail.com') and length(split_part(u.email, '@', 1)) - length(replace(split_part(u.email, '@', 1), '.', '')) >= 3)
        group by 1 order by 2 desc`,
    ),
    query<{ label: string; n: number }>(
      `select coalesce(use_case, 'not answered') as label, count(*)::int as n from users u
        where created_at > now() - interval '90 days' and not exists (select 1 from memberships m where m.user_id = u.id)
        group by 1 order by 2 desc`,
    ),
    query<{ label: string; n: number }>(
      `select case when planned_seats is null then 'not answered' when planned_seats <= 5 then '2–5' when planned_seats <= 10 then '6–10'
                   when planned_seats <= 25 then '11–25' else '26+' end as label, count(*)::int as n
         from organizations where created_at > now() - interval '90 days' group by 1 order by 2 desc`,
    ),
    query<{ label: string; n: number }>(
      `select initcap(lower(name)) as label, count(*)::int as n from services group by 1 order by 2 desc, 1 limit 10`,
    ),
    query<{ label: string; n: number }>(
      `select initcap(lower(name)) as label, count(*)::int as n from outcomes where archived_at is null group by 1 order by 2 desc, 1 limit 10`,
    ),
  ]);
  return { types, uses, sizes, services, outcomes };
}

/** Activation: of accounts that signed up 7–90 days ago, % who added 3+ people AND logged a check-in in their first 7 days. */
export async function activation() {
  return queryOne<{ total: number; added3: number; checked_in: number; activated: number }>(
    `with u as (select id, created_at from users where created_at between now() - interval '90 days' and now() - interval '7 days'),
     a as (
       select u.id,
              (select count(*) from people p where p.user_id = u.id and not p.is_sample and p.created_at < u.created_at + interval '7 days') >= 3 as added3,
              exists (select 1 from check_ins c where c.user_id = u.id and c.created_at < u.created_at + interval '7 days') as checked_in
         from u)
     select count(*)::int as total, count(*) filter (where added3)::int as added3,
            count(*) filter (where checked_in)::int as checked_in, count(*) filter (where added3 and checked_in)::int as activated
       from a`,
  );
}

/** Retention by sign-up week (last 8 weeks): % who signed in again 1, 2 and 4+ weeks after signing up. */
export async function cohorts() {
  return query<{ week: string; size: number; w1: number | null; w2: number | null; w4: number | null }>(
    `select to_char(date_trunc('week', u.created_at), 'Mon DD') as week, count(*)::int as size,
            case when date_trunc('week', u.created_at) + interval '14 days' <= now()
                 then count(*) filter (where au.last_sign_in_at >= u.created_at + interval '7 days')::int end as w1,
            case when date_trunc('week', u.created_at) + interval '21 days' <= now()
                 then count(*) filter (where au.last_sign_in_at >= u.created_at + interval '14 days')::int end as w2,
            case when date_trunc('week', u.created_at) + interval '35 days' <= now()
                 then count(*) filter (where au.last_sign_in_at >= u.created_at + interval '28 days')::int end as w4
       from users u join auth.users au on au.id = u.id
      where u.created_at > date_trunc('week', now()) - interval '7 weeks'
      group by date_trunc('week', u.created_at) order by date_trunc('week', u.created_at) desc`,
  );
}

/** Share of accounts (or organizations) using each feature. */
export async function featureUse() {
  return queryOne<{
    users: number;
    orgs: number;
    kiosk: number;
    referral: number;
    outcomes: number;
    voice: number;
    ai: number;
    calendar: number;
    reports: number;
    org_reports: number;
    import_people: number;
  }>(
    `select (select count(*)::int from users) as users,
            (select count(*)::int from organizations) as orgs,
            (select count(*)::int from user_settings where kiosk_pin_hash is not null) as kiosk,
            (select count(*)::int from organizations where referral_enabled) as referral,
            (select count(distinct user_id)::int from person_outcomes where deleted_at is null) as outcomes,
            (select count(distinct user_id)::int from usage_counters where kind = 'transcribe') as voice,
            (select count(distinct user_id)::int from usage_counters where kind in ('ai.command', 'ai.summary')) as ai,
            (select count(distinct user_id)::int from (select user_id from calendar_feeds union select user_id from user_settings where calendar_feed_token is not null) c) as calendar,
            (select count(distinct user_id)::int from usage_counters where kind = 'export') as reports,
            (select count(*)::int from organizations where first_report_at is not null) as org_reports,
            (select count(*)::int from (select user_id from people where not is_sample group by user_id having count(*) >= 10) p) as import_people`,
  );
}

/** Sign-ups by device (from sign-up, since Nov 15, 2026) and by time zone (rough region), 90 days. */
export async function whereFrom() {
  const [devices, zones] = await Promise.all([
    query<{ label: string; n: number }>(
      `select coalesce(meta->>'device', 'not recorded') as label, count(*)::int as n from app_events
        where kind = 'auth.signup' and message not ilike '%bot%' and created_at > now() - interval '90 days'
        group by 1 order by 2 desc`,
    ),
    query<{ label: string; n: number }>(
      `select coalesce(timezone, 'not set') as label, count(*)::int as n from users
        where created_at > now() - interval '90 days' group by 1 order by 2 desc limit 8`,
    ),
  ]);
  return { devices, zones };
}

/** Health checks: when each moving part last worked. */
export async function healthChecks() {
  return queryOne<{
    last_email: string | null;
    email_failed_24h: number;
    last_webhook: string | null;
    webhook_failed_24h: number;
    last_cron: string | null;
    errors_24h: number;
    db_bytes: string;
  }>(
    `select (select value from app_meta where key = 'email_sent_at') as last_email,
            (select count(*)::int from app_events where kind = 'email.failed' and created_at > now() - interval '24 hours') as email_failed_24h,
            (select value from app_meta where key = 'stripe_webhook_at') as last_webhook,
            (select count(*)::int from app_events where kind in ('stripe.webhook_failed', 'stripe.bad_signature') and created_at > now() - interval '24 hours') as webhook_failed_24h,
            (select value from app_meta where key = 'cron_reminders_at') as last_cron,
            (select count(*)::int from app_events where level = 'error' and created_at > now() - interval '24 hours') as errors_24h,
            pg_database_size(current_database())::text as db_bytes`,
  );
}
