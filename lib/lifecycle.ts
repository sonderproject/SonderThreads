import { createHmac } from "crypto";
import { query, queryOne } from "@/lib/db/client";
import { appUrl, escapeHtml, sendEmail } from "@/lib/email";
import { isLikelyBot, logEvent } from "@/lib/events";
import { ownerEmails } from "@/lib/owner";
import { INDIVIDUAL_NO_CARD_FROM, INDIVIDUAL_TRIAL_DAYS, SKIP_TRIAL_OFFER } from "@/lib/billing";
import { calculateMonthlyPriceCents, formatCents } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/settings-options";

/**
 * Trial emails ("lifecycle" emails), sent by the 5-minute cron job
 * (app/api/cron/reminders) through Resend, each one at most once per account
 * (table lifecycle_emails):
 *
 *   welcome        ~15 minutes after the email is confirmed
 *   tips           day 3: one tip that fits how they use Surfdesk
 *   trial_ending   2 days before a trial ends (no-card trials: add a card;
 *                  card trials: when and how much they'll be charged)
 *   trial_ended    the no-card trial ended: their data is still there
 *   payment_failed sent from the Stripe webhook (sendPaymentFailedEmail)
 *
 * Welcome and tips are only for accounts created after LIFECYCLE_FROM, and
 * respect the unsubscribe link (users.email_tips_opt_out). Billing emails
 * always send.
 */
export const LIFECYCLE_FROM = new Date("2026-11-14T00:00:00Z");
const PER_RUN = 40;

type Recipient = { id: string; email: string; name: string | null };

/** Marks a send; false if it was already sent (so it never goes twice). */
async function claim(userId: string, kind: string, ref = ""): Promise<boolean> {
  const row = await queryOne(
    `insert into lifecycle_emails (user_id, kind, ref) values ($1, $2, $3) on conflict do nothing returning 1 as ok`,
    [userId, kind, ref],
  );
  return Boolean(row);
}

function skip(r: Recipient): boolean {
  return isLikelyBot(r.email) || ownerEmails().includes(r.email.toLowerCase());
}

function firstName(r: Recipient): string {
  return r.name?.trim().split(/\s+/)[0] || "there";
}

/** Signed one-click unsubscribe link for welcome/tip emails (not billing). */
export function unsubscribeToken(userId: string): string | null {
  // Signed with CRON_SECRET; without it (never in production) links aren't made and none are accepted.
  const secret = process.env.CRON_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only");
  if (!secret) return null;
  return createHmac("sha256", secret).update(`tips:${userId}`).digest("base64url").slice(0, 32);
}
function unsubscribeUrl(userId: string): string | null {
  const t = unsubscribeToken(userId);
  return t ? `${appUrl()}/api/email/unsubscribe?${new URLSearchParams({ u: userId, t })}` : null;
}

/** The business's mailing address for promotional emails (CAN-SPAM). Set POSTAL_ADDRESS in Vercel. */
function postalAddress(): string | null {
  return process.env.POSTAL_ADDRESS?.trim() || null;
}

/** Plain, readable email (no images): greeting, paragraphs, one button. */
function compose(opts: {
  to: Recipient;
  subject: string;
  lines: string[];
  cta?: { label: string; path: string };
  unsubscribe?: boolean;
}): { to: string; subject: string; text: string; html: string } {
  const cta = opts.cta ? { label: opts.cta.label, url: `${appUrl()}${opts.cta.path}` } : null;
  const greet = `Hi ${firstName(opts.to)},`;
  const sign = "Dante, founder of Surfdesk";
  const unsub = opts.unsubscribe ? unsubscribeUrl(opts.to.id) : null;
  const text = [
    greet,
    "",
    ...opts.lines.flatMap((l) => [l, ""]),
    ...(cta ? [`${cta.label}: ${cta.url}`, ""] : []),
    sign,
    "Just reply to this email if you have a question.",
    ...(unsub ? ["", `Don't want tips like this? ${unsub}`] : []),
    ...(postalAddress() ? ["", `Sonder Project, ${postalAddress()}`] : []),
  ].join("\n");
  const p = (s: string) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(s)}</p>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#1d1d1b;max-width:520px">
${p(greet)}
${opts.lines.map(p).join("\n")}
${
  cta
    ? `<p style="margin:20px 0"><a href="${escapeHtml(cta.url)}" style="background:#1c77b5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : ""
}
${p(sign)}
<p style="margin:0 0 14px;line-height:1.55;color:#6b6b66;font-size:13px">Just reply to this email if you have a question.</p>
${unsub ? `<p style="margin:18px 0 0;color:#6b6b66;font-size:12px"><a href="${escapeHtml(unsub)}" style="color:#6b6b66">Unsubscribe from tips</a></p>` : ""}
${postalAddress() ? `<p style="margin:6px 0 0;color:#6b6b66;font-size:12px">Sonder Project, ${escapeHtml(postalAddress()!)}</p>` : ""}
</div>`;
  return { to: opts.to.email, subject: opts.subject, text, html };
}

async function send(r: Recipient, kind: string, ref: string, mail: ReturnType<typeof compose>): Promise<boolean> {
  if (!(await claim(r.id, kind, ref))) return false;
  try {
    await sendEmail({ ...mail, replyTo: SUPPORT_EMAIL });
    await logEvent(`email.${kind}`, `Sent "${mail.subject}"`, { email: r.email, meta: { kind, ref } });
    return true;
  } catch (err) {
    // Let the next run try again.
    await query(`delete from lifecycle_emails where user_id = $1 and kind = $2 and ref = $3`, [r.id, kind, ref]);
    console.error("[lifecycle] send failed", kind, r.email, err);
    return false;
  }
}

type Who = Recipient & { org_kind: string | null; org_name: string | null; is_admin: boolean };

/** Confirmed accounts, with their organization (if any). */
const WHO = `select u.id, u.email, u.name, o.kind as org_kind, o.name as org_name, coalesce(m.role = 'admin', false) as is_admin
               from users u
               join auth.users a on a.id = u.id and a.email_confirmed_at is not null
               left join memberships m on m.user_id = u.id and m.active
               left join organizations o on o.id = m.org_id`;

function welcomeFor(r: Who) {
  if (r.org_kind) {
    const nonprofit = r.org_kind !== "business";
    return compose({
      to: r,
      subject: `Welcome to Surfdesk${r.org_name ? `, ${r.org_name}` : ""}`,
      lines: [
        `Thanks for setting up ${r.org_name ?? "your organization"} on Surfdesk. Three things that make the first week count:`,
        "1. Invite your staff from the Organization page, so everyone's work lands in one place.",
        `2. Upload your client list from Excel on the People page (Import). It takes about a minute.`,
        `3. Log a few ${nonprofit ? "check-ins" : "visits"}, then open ${nonprofit ? "Impact" : "Insights"} to see your report build itself.`,
      ],
      cta: { label: "Open Surfdesk", path: "/team" },
      unsubscribe: true,
    });
  }
  return compose({
    to: r,
    subject: "Welcome to Surfdesk",
    lines: [
      "Thanks for trying Surfdesk. Three things to try first:",
      `1. Type a sentence in the command bar, like "Remind me to call Sarah Friday at 3". It becomes a task linked to Sarah.`,
      "2. Add the people you keep up with, or import a list from Excel or your phone's contacts.",
      "3. Install it on your phone: open thesurfdesk.app in your browser and choose Add to Home Screen.",
    ],
    cta: { label: "Open Surfdesk", path: "/" },
    unsubscribe: true,
  });
}

function tipFor(r: Who) {
  if (r.org_kind === "business")
    return compose({
      to: r,
      subject: "See what your business brings in",
      lines: [
        "Quick tip: add prices to your services in Settings → Services. Every visit your staff log with a service then shows up as revenue in Insights, with your busiest days and most popular services.",
        "At the end of the month, download the PDF and you've got your numbers without a spreadsheet.",
      ],
      cta: { label: "Set up your services", path: "/settings/services" },
      unsubscribe: true,
    });
  if (r.org_kind)
    return compose({
      to: r,
      subject: "Your next funder report, done in a click",
      lines: [
        "Quick tip: everything your staff log in Surfdesk already adds up in Impact: people served (each counted once), new vs returning, demographics and busiest times.",
        "Pick the month, download the PDF or Excel file, and send it to your board or funder. No spreadsheets to pull together.",
        "If your front desk still signs people in on paper, turn on the kiosk in Settings; check-ins then land in Surfdesk by themselves.",
      ],
      cta: { label: "Open your Impact report", path: "/impact" },
      unsubscribe: true,
    });
  return compose({
    to: r,
    subject: "The fastest way to use Surfdesk",
    lines: [
      "Quick tip: you rarely need to open a form. Press / (or tap the mic) and say what happened:",
      `"Ana got the job at Target" adds a note to Ana. "Call Jo every Monday" makes a repeating task. "Ana – haircut $45" logs a service.`,
      "Surfdesk files it in the right place and reminds you when it's time.",
    ],
    cta: { label: "Try it now", path: "/" },
    unsubscribe: true,
  });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/** `since` is only overridden in tests. */
export async function runLifecycleEmails(since: Date = LIFECYCLE_FROM): Promise<number> {
  let sent = 0;

  // Welcome: confirmed at least 15 minutes ago (the guided set-up is done by then), new accounts only.
  const welcome = await query<Who>(
    `${WHO}
      where u.created_at > $1 and a.email_confirmed_at < now() - interval '15 minutes'
        and a.email_confirmed_at > now() - interval '3 days'
        and (m.user_id is null or m.role = 'admin')
        and not coalesce(u.email_tips_opt_out, false)
        and not exists (select 1 from lifecycle_emails l where l.user_id = u.id and l.kind = 'welcome')
      limit ${PER_RUN}`,
    [since],
  );
  for (const r of welcome) if (!skip(r) && (await send(r, "welcome", "", welcomeFor(r)))) sent++;

  // Day 3 tip. It's promotional, so (US CAN-SPAM) it needs the business's mailing address:
  // it only sends once POSTAL_ADDRESS is set in Vercel.
  const tips = !postalAddress()
    ? []
    : await query<Who>(
    `${WHO}
      where u.created_at > $1 and u.created_at < now() - interval '3 days' and u.created_at > now() - interval '6 days'
        and (m.user_id is null or m.role = 'admin')
        and not coalesce(u.email_tips_opt_out, false)
        and not exists (select 1 from lifecycle_emails l where l.user_id = u.id and l.kind = 'tips')
      limit ${PER_RUN}`,
    [since],
  );
  for (const r of tips) if (!skip(r) && (await send(r, "tips", "", tipFor(r)))) sent++;

  // No-card individual trials: ending within 2 days, and ended within the last 3 days.
  const trialEnd = `(greatest(u.created_at, $1::timestamptz) + make_interval(days => ${INDIVIDUAL_TRIAL_DAYS}))`;
  const noCard = `m.user_id is null
        and not exists (select 1 from billing_accounts b where b.user_id = u.id
                          and (b.stripe_subscription_id is not null or b.plan = 'comp' or b.status = 'comp'))
        and not exists (select 1 from invitations i where lower(i.email) = lower(u.email) and i.accepted_at is null and i.expires_at > now())`;
  const ending = await query<Who & { ends: string | Date }>(
    `${WHO.replace("select u.id", `select ${trialEnd} as ends, u.id`)}
      where ${noCard} and ${trialEnd} between now() and now() + interval '2 days'
        and not exists (select 1 from lifecycle_emails l where l.user_id = u.id and l.kind = 'trial_ending' and l.ref = '')
      limit ${PER_RUN}`,
    [INDIVIDUAL_NO_CARD_FROM],
  );
  for (const r of ending) {
    if (skip(r)) continue;
    const mail = compose({
      to: r,
      subject: "Your Surfdesk trial ends in 2 days",
      lines: [
        `Your free trial ends on ${fmtDay(new Date(r.ends))}. Add a card to keep using Surfdesk without a break: it's $9 a month, and you can cancel any time in Billing.`,
        `Or start today with ${SKIP_TRIAL_OFFER.percentOff}% off your first month.`,
        "If you don't add one, nothing is deleted: your account becomes view-only, and you can still export everything.",
      ],
      cta: { label: "Keep Surfdesk", path: "/billing?offer=skip" },
    });
    if (await send(r, "trial_ending", "", mail)) sent++;
  }

  const ended = await query<Who>(
    `${WHO}
      where ${noCard} and ${trialEnd} between greatest(now() - interval '3 days', $2::timestamptz) and now()
        and not exists (select 1 from lifecycle_emails l where l.user_id = u.id and l.kind = 'trial_ended')
      limit ${PER_RUN}`,
    [INDIVIDUAL_NO_CARD_FROM, since],
  );
  for (const r of ended) {
    if (skip(r)) continue;
    const mail = compose({
      to: r,
      subject: "Your Surfdesk trial ended (your data is still here)",
      lines: [
        "Your free trial has ended, so your account is view-only for now. Everything you added is still there, and you can export it any time.",
        "Add a card to pick up right where you left off: $9 a month, cancel any time.",
      ],
      cta: { label: "Pick up where you left off", path: "/billing" },
    });
    if (await send(r, "trial_ended", "", mail)) sent++;
  }

  // Card trials (organizations, and individuals who started with a card): 2 days before the first charge.
  const cardTrials = await query<{
    billing_id: string;
    user_id: string | null;
    org_id: string | null;
    plan: string;
    seats: number | null;
    ends: string | Date;
  }>(
    `select id as billing_id, user_id, org_id, plan, seats, current_period_end as ends from billing_accounts
      where status = 'trialing' and stripe_subscription_id is not null and not cancel_at_period_end
        and current_period_end between now() and now() + interval '2 days'
      limit ${PER_RUN}`,
  );
  for (const t of cardTrials) {
    // pg returns timestamps as Date objects.
    const endsAt = new Date(t.ends);
    const ref = `${t.billing_id}:${endsAt.toISOString().slice(0, 10)}`;
    const people = await query<Who>(
      t.org_id ? `${WHO} where m.org_id = $1 and m.role = 'admin'` : `${WHO} where u.id = $1`,
      [t.org_id ?? t.user_id],
    );
    let price = "";
    try {
      const cents =
        t.plan === "individual" ? calculateMonthlyPriceCents("individual", 1) : t.plan === "org" && t.seats ? calculateMonthlyPriceCents("organization", t.seats) : null;
      if (cents) price = ` ${formatCents(cents)}${t.plan === "org" ? ` for ${t.seats} seats` : ""}`;
    } catch {
      // leave the amount out
    }
    for (const r of people) {
      if (skip(r)) continue;
      const mail = compose({
        to: r,
        subject: "Your Surfdesk free trial ends in 2 days",
        lines: [
          `Your free trial${r.org_name ? ` for ${r.org_name}` : ""} ends on ${fmtDay(endsAt)}. On that day your card on file will be charged${price} for the first month, then monthly until you cancel.`,
          "Nothing to do if you'd like to keep going. To change seats or cancel before then, go to Billing.",
        ],
        cta: { label: "Review billing", path: "/billing" },
      });
      if (await send(r, "trial_ending", ref, mail)) sent++;
    }
  }
  return sent;
}

/** Stripe webhook: a renewal payment failed. One email per invoice to the people who pay. */
export async function sendPaymentFailedEmail(invoiceId: string, customerId: string | null, amount: string): Promise<void> {
  if (!customerId) return;
  const acct = await queryOne<{ user_id: string | null; org_id: string | null }>(
    `select user_id, org_id from billing_accounts where stripe_customer_id = $1`,
    [customerId],
  );
  if (!acct) return;
  const people = await query<Who>(
    acct.org_id ? `${WHO} where m.org_id = $1 and m.role = 'admin'` : `${WHO} where u.id = $1`,
    [acct.org_id ?? acct.user_id],
  );
  for (const r of people) {
    if (skip(r)) continue;
    const mail = compose({
      to: r,
      subject: "Your Surfdesk payment didn't go through",
      lines: [
        `We couldn't charge ${amount} to the card on file${r.org_name ? ` for ${r.org_name}` : ""}. Stripe will try again over the next few days.`,
        "Nothing changes right away: you keep full access for 14 days. Update your card in Billing to avoid any interruption.",
      ],
      cta: { label: "Update your card", path: "/billing" },
    });
    await send(r, "payment_failed", invoiceId, mail);
  }
}
