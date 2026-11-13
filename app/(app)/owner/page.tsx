import type { Metadata } from "next";
import type Stripe from "stripe";
import { requireOwner } from "@/lib/owner";
import { query, queryOne } from "@/lib/db/client";
import { isLikelyBot } from "@/lib/events";
import { stripe } from "@/lib/billing";
import { ownerResendConfirmation } from "@/lib/actions/owner";

export const metadata: Metadata = { title: "Command center", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/*
 * The owner's command center. Unlike every other page, it reads across all
 * accounts on purpose; requireOwner() (which uses requireUserId()) gates it,
 * and anyone who isn't the owner gets a plain 404.
 */

type Signup = {
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  plan: string | null;
  status: string | null;
};
type EventRow = { id: string; kind: string; level: "info" | "warn" | "error"; message: string; email: string | null; path: string | null; created_at: string };

const KIND_LABELS: Record<string, string> = {
  "app.error": "Server error",
  "app.error_screen": "Error screen",
  "auth.link_failed": "Email link failed",
  "auth.signup_failed": "Sign-up failed",
  "auth.signup": "Sign-up",
  "stripe.webhook_failed": "Stripe webhook",
  "stripe.bad_signature": "Stripe webhook",
  "billing.payment_failed": "Payment failed",
  "billing.subscribed": "Subscribed",
  "billing.converted": "Trial converted",
  "billing.canceled": "Canceled",
  "billing.ended": "Subscription ended",
  "owner.resent_confirmation": "Resent confirmation",
  "owner.resend_failed": "Resend failed",
  "referral.received": "Referral",
  "referral.email_capped": "Referral email capped",
  "billing.seats_changed": "Seats changed",
  "email.failed": "Email failed",
};

function when(d: string | null): string {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Live money numbers from Stripe, limited to Strynd subscriptions (the account also sells other things). */
async function stripeNumbers() {
  const s = stripe();
  if (!s) return null;
  try {
    const [subs, invoices, balance] = await Promise.all([
      s.subscriptions.list({ status: "active", limit: 100, expand: ["data.discounts"] }),
      s.invoices.list({ status: "paid", limit: 30 }),
      s.balance.retrieve(),
    ]);
    const ours = (meta: Stripe.Metadata | null | undefined) => meta?.kind === "user" || meta?.kind === "org";
    let mrr = 0;
    for (const sub of subs.data.filter((x) => ours(x.metadata))) {
      let amount = sub.items.data.reduce((sum, it) => sum + (it.price.unit_amount ?? 0) * (it.quantity ?? 1), 0);
      for (const d of sub.discounts ?? []) {
        if (typeof d === "string") continue;
        if (d.coupon.amount_off) amount -= d.coupon.amount_off;
        else if (d.coupon.percent_off) amount -= Math.round((amount * d.coupon.percent_off) / 100);
      }
      mrr += Math.max(0, amount);
    }
    const charges = invoices.data
      .filter((i) => ours(i.subscription_details?.metadata) && i.amount_paid > 0)
      .slice(0, 8)
      .map((i) => ({ id: i.id, email: i.customer_email, amount: i.amount_paid, at: i.status_transitions.paid_at ?? i.created }));
    const available = balance.available.find((b) => b.currency === "usd")?.amount ?? 0;
    const pending = balance.pending.find((b) => b.currency === "usd")?.amount ?? 0;
    return { mrr, charges, available, pending };
  } catch (err) {
    console.error("[owner] stripe numbers failed", err);
    return null;
  }
}

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ resend?: string; email?: string }> }) {
  await requireOwner();
  const { resend, email: resentTo } = await searchParams;

  // Sign-ups by the ad campaign that brought them (utm tags carried to the sign-up form), and how many
  // went on to a card on file / paid subscription (their own account, or an organization they're in).
  const sources = await query<{ source: string; signups: number; converted: number }>(
    `select coalesce(e.meta->>'utm_campaign', e.meta->>'utm_source', 'Direct / unknown') as source,
            count(*)::int as signups,
            count(*) filter (where exists (
              select 1 from users u
               where lower(u.email) = lower(e.email)
                 and (exists (select 1 from billing_accounts b where b.user_id = u.id and b.stripe_subscription_id is not null)
                      or exists (select 1 from memberships m join billing_accounts b2 on b2.org_id = m.org_id
                                  where m.user_id = u.id and m.active and b2.stripe_subscription_id is not null))
            ))::int as converted
       from app_events e
      where e.kind = 'auth.signup' and e.message not ilike '%bot%' and e.created_at > now() - interval '30 days'
      group by 1 order by 2 desc limit 20`,
  ).catch(() => []);
  const [signups, billing, trialsEnding, events, errors24, money$] = await Promise.all([
    query<Signup>(
      `select u.email, u.created_at, u.email_confirmed_at, u.last_sign_in_at, b.plan, b.status
         from auth.users u left join billing_accounts b on b.user_id = u.id
        where u.created_at > now() - interval '30 days'
        order by u.created_at desc limit 200`,
    ),
    queryOne<{ paying: number; trialing: number; past_due: number; canceling: number; saved: number; comp: number; ended30: number }>(
      `select count(*) filter (where status = 'active' and plan <> 'comp')::int as paying,
              (select count(*) from app_events where kind = 'billing.ended' and created_at > now() - interval '30 days')::int as ended30,
              count(*) filter (where status = 'trialing' and stripe_subscription_id is not null)::int as trialing,
              count(*) filter (where status in ('past_due', 'unpaid'))::int as past_due,
              count(*) filter (where cancel_at_period_end and status in ('active', 'trialing'))::int as canceling,
              count(*) filter (where save_offer_used_at is not null)::int as saved,
              count(*) filter (where plan = 'comp')::int as comp
         from billing_accounts`,
    ),
    query<{ email: string | null; ends: string; canceling: boolean }>(
      `select coalesce(u.email, o.name) as email, b.current_period_end as ends, b.cancel_at_period_end as canceling
         from billing_accounts b
         left join users u on u.id = b.user_id
         left join organizations o on o.id = b.org_id
        where b.status = 'trialing' and b.stripe_subscription_id is not null
          and b.current_period_end < now() + interval '7 days'
        order by b.current_period_end`,
    ),
    query<EventRow>(
      `select id, kind, level, message, email, path, created_at from app_events
        where kind <> 'alert' order by created_at desc limit 60`,
    ),
    queryOne<{ n: number }>(`select count(*)::int as n from app_events where level = 'error' and created_at > now() - interval '24 hours'`),
    stripeNumbers(),
  ]);

  const real = signups.filter((s) => !isLikelyBot(s.email));
  const bots = signups.length - real.length;
  const day = Date.now() - 86_400_000;
  const week = Date.now() - 7 * 86_400_000;
  const today = real.filter((s) => new Date(s.created_at).getTime() > day).length;
  const thisWeek = real.filter((s) => new Date(s.created_at).getTime() > week).length;
  const stuck = real.filter(
    (s) => !s.email_confirmed_at && Date.now() - new Date(s.created_at).getTime() > 3_600_000 && new Date(s.created_at).getTime() > Date.now() - 14 * 86_400_000,
  );
  const linkFailures = events.filter((e) => e.kind === "auth.link_failed" && new Date(e.created_at).getTime() > week).length;
  const problems = events.filter((e) => e.level !== "info");
  const activity = events.filter((e) => e.level === "info");

  const tiles: { label: string; value: string; note?: string; tone?: "warn" | "urgent" }[] = [
    { label: "Sign-ups today", value: String(today), note: `${thisWeek} this week` },
    { label: "Paying customers", value: String(billing?.paying ?? 0), note: billing?.comp ? `+${billing.comp} free for life` : undefined },
    { label: "In free trial", value: String(billing?.trialing ?? 0), note: trialsEnding.length ? `${trialsEnding.length} ending this week` : undefined },
    { label: "MRR", value: money$ ? money(money$.mrr) : "—", note: "Monthly recurring revenue" },
    { label: "Errors (24h)", value: String(errors24?.n ?? 0), tone: (errors24?.n ?? 0) > 0 ? "urgent" : undefined },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-1">
        <p className="eyebrow text-text-faint">Owner only</p>
        <h1 className="page-title">Command center</h1>
        <p className="text-sm text-text-muted">Sign-ups, money and problems across all of Strynd.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className={`card space-y-1 p-4 ${t.tone === "urgent" ? "flag-urgent" : ""}`}>
            <p className="eyebrow text-text-faint">{t.label}</p>
            <p className="font-display text-3xl font-light tabular-nums text-text">{t.value}</p>
            {t.note && <p className="text-xs text-text-muted">{t.note}</p>}
          </div>
        ))}
      </section>

      <section id="attention" className="scroll-mt-20 space-y-3">
        <h2 className="section-label">Needs attention</h2>
        {resend === "sent" && <p className="text-sm text-accent">Confirmation email sent to {resentTo}.</p>}
        {resend === "failed" && (
          <p className="flag text-sm">Couldn&apos;t resend to {resentTo}. Supabase allows one resend per minute per person; try again shortly.</p>
        )}
        {stuck.length === 0 && !billing?.past_due && linkFailures === 0 ? (
          <div className="card p-4 text-sm text-text-muted">Nothing needs you right now.</div>
        ) : (
          <div className="card divide-y divide-border">
            {stuck.map((s) => (
              <div key={s.email} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{s.email}</p>
                  <p className="text-xs text-text-muted">Signed up {when(s.created_at)}, hasn&apos;t confirmed their email</p>
                </div>
                <form action={ownerResendConfirmation}>
                  <input type="hidden" name="email" value={s.email} />
                  <button type="submit" className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover">
                    Resend confirmation
                  </button>
                </form>
              </div>
            ))}
            {(billing?.past_due ?? 0) > 0 && (
              <p className="p-4 text-sm text-text">
                <span className="tag tag-e mr-2">Payment failed</span>
                {billing!.past_due} {billing!.past_due === 1 ? "customer has" : "customers have"} a failed payment. Stripe retries automatically.
              </p>
            )}
            {linkFailures > 0 && (
              <p className="p-4 text-sm text-text">
                <span className="tag tag-u mr-2">Email links</span>
                {linkFailures} email {linkFailures === 1 ? "link" : "links"} failed this week. See Problems below.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Money</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card space-y-2 p-4 text-sm">
            <Row label="Paying customers" value={String(billing?.paying ?? 0)} />
            <Row label="In free trial" value={String(billing?.trialing ?? 0)} />
            <Row label="Canceling at period end" value={String(billing?.canceling ?? 0)} />
            <Row label="Took the $5 save offer" value={String(billing?.saved ?? 0)} />
            <Row label="Failed payments" value={String(billing?.past_due ?? 0)} />
            <Row label="Ended, last 30 days" value={String(billing?.ended30 ?? 0)} />
            <Row
              label="Churn, last 30 days"
              value={(() => {
                const ended = billing?.ended30 ?? 0;
                const base = (billing?.paying ?? 0) + ended;
                return base === 0 ? "—" : `${Math.round((ended / base) * 1000) / 10}%`;
              })()}
            />
            <p className="text-xs text-text-faint">Churn: subscriptions that ended ÷ (paying now + ended), past 30 days.</p>
            {money$ && (
              <>
                <Row label="Stripe balance, available" value={money(money$.available)} />
                <Row label="Stripe balance, on the way" value={money(money$.pending)} />
                <p className="text-xs text-text-faint">Balance covers your whole Stripe account, not only Strynd.</p>
              </>
            )}
          </div>
          <div className="card space-y-2 p-4 text-sm">
            <p className="eyebrow text-text-faint">Trials ending this week</p>
            {trialsEnding.length === 0 && <p className="text-text-muted">None.</p>}
            {trialsEnding.map((t, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="truncate text-text">{t.email}</span>
                <span className="shrink-0 text-text-muted">{t.canceling ? "canceling" : new Date(t.ends).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            ))}
            <p className="eyebrow pt-2 text-text-faint">Recent payments</p>
            {!money$ && <p className="text-text-muted">Couldn&apos;t reach Stripe.</p>}
            {money$?.charges.length === 0 && <p className="text-text-muted">No payments yet.</p>}
            {money$?.charges.map((c) => (
              <div key={c.id} className="flex justify-between gap-3">
                <span className="truncate text-text">{c.email}</span>
                <span className="shrink-0 tabular-nums text-text">{money(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Problems</h2>
        {problems.length === 0 ? (
          <div className="card p-4 text-sm text-text-muted">No problems recorded yet. Errors, failed email links and failed payments show up here.</div>
        ) : (
          <div className="card divide-y divide-border">
            {problems.map((e) => (
              <div key={e.id} className="space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`tag ${e.level === "error" ? "tag-e" : "tag-u"}`}>{KIND_LABELS[e.kind] ?? e.kind}</span>
                  <span className="text-xs text-text-muted">{when(e.created_at)}</span>
                  {e.path && <span className="text-xs text-text-faint">{e.path}</span>}
                </div>
                <p className="break-words text-sm text-text">{e.message}</p>
                {e.email && <p className="text-xs text-text-muted">{e.email}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Sign-ups by source (30 days)</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-b border-border text-left text-text-faint">
                <th className="px-4 py-2 font-semibold">Campaign</th>
                <th className="px-3 py-2 text-right font-semibold">Sign-ups</th>
                <th className="px-4 py-2 text-right font-semibold">Card or paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sources.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-text-muted">No sign-ups yet.</td>
                </tr>
              )}
              {sources.map((r) => (
                <tr key={r.source}>
                  <td className="px-4 py-2 text-text">{r.source}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.signups}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.converted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-faint">
          From ad links tagged with utm_campaign (see docs/marketing/linkedin-ads.md). Likely bots excluded.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Sign-ups (30 days)</h2>
        <div className="card divide-y divide-border">
          {real.length === 0 && <p className="p-4 text-sm text-text-muted">No sign-ups yet.</p>}
          {real.slice(0, 50).map((s) => (
            <div key={s.email} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm text-text">{s.email}</p>
                <p className="text-xs text-text-muted">
                  {when(s.created_at)}
                  {s.last_sign_in_at ? ` · last in ${when(s.last_sign_in_at)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!s.email_confirmed_at && <span className="tag tag-u">Unconfirmed</span>}
                {s.status === "active" && s.plan !== "comp" && <span className="tag tag-v">Paying</span>}
                {s.status === "trialing" && <span className="tag tag-n">Trial</span>}
                {s.plan === "comp" && <span className="tag tag-v">Free for life</span>}
                {s.status === "past_due" && <span className="tag tag-e">Past due</span>}
              </div>
            </div>
          ))}
        </div>
        {bots > 0 && (
          <p className="text-xs text-text-faint">
            {bots} likely bot {bots === 1 ? "sign-up" : "sign-ups"} hidden (dotted Gmail addresses). Turning on the sign-up CAPTCHA stops these.
          </p>
        )}
      </section>

      {activity.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-label">Recent activity</h2>
          <div className="card divide-y divide-border">
            {activity.slice(0, 15).map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="text-text">
                  <span className="text-text-muted">{KIND_LABELS[e.kind] ?? e.kind}:</span> {e.email ?? e.message}
                </span>
                <span className="text-xs text-text-muted">{when(e.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className="tabular-nums text-text">{value}</span>
    </div>
  );
}
