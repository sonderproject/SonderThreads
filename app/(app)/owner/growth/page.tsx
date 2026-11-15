import type { Metadata } from "next";
import { requireOwner } from "@/lib/owner";
import { queryOne } from "@/lib/db/client";
import { OwnerNav, Tile, money, pct, when } from "@/components/owner/OwnerNav";
import { customerHealth, marketingList, referralGrowth, revenueByMonth, stripeNumbers, trialConversion } from "@/lib/owner-stats";

export const metadata: Metadata = { title: "Growth · Command center", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const QUIET_DAYS = 7;

/** Money, conversion, churn, at-risk customers, referral links and the marketing list. */
export default async function OwnerGrowthPage() {
  await requireOwner();
  const [live, months, conv, churn, health, refs, mkt] = await Promise.all([
    stripeNumbers(),
    revenueByMonth(),
    trialConversion(),
    queryOne<{ paying: number; ended30: number }>(
      `select count(*) filter (where status = 'active' and plan <> 'comp')::int as paying,
              (select count(*)::int from app_events where kind = 'billing.ended' and created_at > now() - interval '30 days') as ended30
         from billing_accounts`,
    ),
    customerHealth(),
    referralGrowth(),
    marketingList(),
  ]);
  const paying = churn?.paying ?? 0;
  const ended = churn?.ended30 ?? 0;
  const quietCutoff = Date.now() - QUIET_DAYS * 86_400_000;
  const lastSeen = (h: { last_in: string | null; last_check_in: string | null }) =>
    Math.max(h.last_in ? new Date(h.last_in).getTime() : 0, h.last_check_in ? new Date(h.last_check_in).getTime() : 0);
  const quiet = health.filter((h) => lastSeen(h) < quietCutoff).length;
  const maxMonth = Math.max(1, ...(months ?? []).map((m) => m.cents));

  return (
    <div className="max-w-3xl space-y-8">
      <OwnerNav active="/owner/growth" title="Growth" intro="Money in, who's at risk of leaving, and what referral links bring in." />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="MRR" value={live ? money(live.mrr) : "—"} note="Monthly recurring revenue" />
        <Tile label="ARPA" value={live && live.subscriptions ? money(Math.round(live.mrr / live.subscriptions)) : "—"} note="Average revenue per paying account" />
        <Tile label="Trial → paid" value={pct(conv.converted, conv.trials)} note={`${conv.converted} of ${conv.trials} finished card trials`} />
        <Tile label="Churn (30 days)" value={pct(ended, paying + ended)} note={`${ended} ended`} urgent={ended > 0 && ended / Math.max(1, paying + ended) > 0.1} />
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Revenue collected by month</h2>
        <div className="card space-y-2 p-4 text-sm">
          {!months && <p className="text-text-muted">Couldn&apos;t reach Stripe.</p>}
          {months?.map((m) => (
            <div key={m.month} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-text-muted">
                {new Date(`${m.month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
              <div className="progress-bar h-2 flex-1">
                <span style={{ width: `${Math.round((m.cents / maxMonth) * 100)}%` }} />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums text-text">{money(m.cents)}</span>
            </div>
          ))}
          <p className="text-xs text-text-faint">Paid Surfdesk invoices only (your Stripe account&apos;s other products aren&apos;t counted). The current month is so far.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Customer health</h2>
        <p className="text-sm text-text-muted">
          {quiet > 0
            ? `${quiet} paying or trialing ${quiet === 1 ? "customer hasn't" : "customers haven't"} been in for ${QUIET_DAYS}+ days. Reach out before they cancel.`
            : "Everyone paying or on a trial has been in within the last week."}
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="eyebrow border-b border-border text-left text-text-faint">
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold">Plan</th>
                <th className="px-3 py-2 text-right font-semibold">Seats</th>
                <th className="px-4 py-2 text-right font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {health.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-text-muted">No paying or trialing customers yet.</td>
                </tr>
              )}
              {health.map((h, i) => {
                const seen = lastSeen(h);
                const isQuiet = seen < quietCutoff;
                return (
                  <tr key={i}>
                    <td className="max-w-[14rem] truncate px-4 py-2 text-text">
                      {isQuiet && <span className="tag tag-e mr-2">Quiet</span>}
                      {h.name}
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {h.kind === "org" ? "Organization" : "Individual"} · {h.status === "trialing" ? "trial" : h.status === "active" ? "paying" : "past due"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.kind === "org" ? `${h.members}/${h.seats ?? "—"}` : "1"}</td>
                    <td className={`px-4 py-2 text-right ${isQuiet ? "text-urgent" : "text-text-muted"}`}>{seen ? when(new Date(seen)) : "never"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-faint">Last active = latest sign-in or check-in by anyone on the account. Seats = members / seats bought.</p>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Referral links</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Links on" value={String(refs.orgs?.active ?? 0)} note={`of ${refs.orgs?.total ?? 0} organizations`} />
          <Tile label="Sign-ups from the note" value={String(refs.signups?.signups ?? 0)} note="“Try Surfdesk” in referral emails and pages" />
          <Tile label="Paid from the note" value={String(refs.signups?.paid ?? 0)} note="Card on file or paying" />
        </div>
        <div className="card space-y-2 p-4 text-sm">
          <p className="eyebrow text-text-faint">Referrals sent per week</p>
          {refs.weeks.length === 0 && <p className="text-text-muted">None yet.</p>}
          {refs.weeks.map((w) => (
            <div key={w.week} className="flex justify-between gap-3">
              <span className="text-text-muted">Week of {w.week}</span>
              <span className="tabular-nums text-text">{w.n}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Email marketing list</h2>
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Opted in" value={String(mkt?.opted_in ?? 0)} note="Tips and offers from Sonder Project" />
          <Tile label="Opt-in rate at sign-up" value={pct(mkt?.opted_at_signup ?? 0, mkt?.since_launch ?? 0)} note="Since the checkbox went live" />
        </div>
        <p className="text-sm">
          <a href="/owner/marketing-list" className="font-semibold text-accent hover:underline">
            Download opted-in emails (CSV)
          </a>
          <span className="text-text-muted"> · Only people who opted in. Sending stays off until POSTAL_ADDRESS is set in Vercel.</span>
        </p>
      </section>
    </div>
  );
}
