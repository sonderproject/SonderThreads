import { query, queryOne } from "@/lib/db/client";
import { appUrl, escapeHtml, sendEmail } from "@/lib/email";
import { isValidTimeZone } from "@/lib/tz";
import { termsFor, type Audience } from "@/lib/terms";
import { computeTiles, type Tile } from "@/lib/dashboard";
import { REPORT_LIMITS, TILES, change, duePeriod, rangeLabel, type TileKey } from "@/lib/dashboard-shared";

/**
 * Scheduled reports (run by the 5-minute cron, and "Send me one now"). Emails carry counts
 * only, to people inside the account: the schedule's owner, or the organization's active
 * Admins and Managers. Each period is sent once; a failed send is retried once, then the
 * owner gets an in-app alert.
 */

export type ScheduleRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  frequency: "weekly" | "monthly";
  weekday: number;
  month_day: number;
  hour: number;
  recipients: "me" | "managers";
  attach_pdf: boolean;
  tiles: TileKey[];
};

type Send = typeof sendEmail;
type Notify = (userId: string, n: { type: string; title: string; body: string; href: string }) => Promise<void>;
const defaultNotify: Notify = async (u, n) => (await import("@/lib/notify")).notify(u, n);

/** The schedule's time zone: the organization's, or the owner's. */
export async function scheduleTz(s: Pick<ScheduleRow, "org_id" | "user_id">): Promise<string> {
  if (s.org_id) return (await import("@/lib/referral-settings")).getOrgTimeZone(s.org_id);
  const r = await queryOne<{ timezone: string | null }>(`select timezone from users where id = $1`, [s.user_id]);
  return isValidTimeZone(r?.timezone) ? r!.timezone! : "UTC";
}

export function localNow(tz: string, now = new Date()): { day: string; weekday: number; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return { day, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday), hour: Number(parts.hour) % 24 };
}

/** May the owner still report on this scope? (Org: active Admin or Manager. Solo: always.) */
async function ownerMayReport(s: Pick<ScheduleRow, "org_id" | "user_id">): Promise<boolean> {
  if (!s.org_id) {
    const inOrg = await queryOne(`select 1 from memberships where user_id = $1 and active`, [s.user_id]);
    return !inOrg; // a solo schedule stops if its owner joins an organization
  }
  const m = await queryOne(`select 1 from memberships where org_id = $1 and user_id = $2 and active and role in ('admin', 'supervisor')`, [s.org_id, s.user_id]);
  return Boolean(m);
}

/** Email addresses, all inside the account. Never anything typed in by hand. */
export async function recipientEmails(s: Pick<ScheduleRow, "org_id" | "user_id" | "recipients">): Promise<string[]> {
  if (s.org_id && s.recipients === "managers") {
    const rows = await query<{ email: string }>(
      `select u.email from memberships m join users u on u.id = m.user_id
        where m.org_id = $1 and m.active and m.role in ('admin', 'supervisor') and u.suspended_at is null`,
      [s.org_id],
    );
    return [...new Set(rows.map((r) => r.email.toLowerCase()))];
  }
  const me = await queryOne<{ email: string }>(`select email from users where id = $1 and suspended_at is null`, [s.user_id]);
  return me ? [me.email] : [];
}

async function audienceOf(s: Pick<ScheduleRow, "org_id">): Promise<Audience> {
  if (!s.org_id) return "individual";
  const o = await queryOne<{ kind: string }>(`select kind from organizations where id = $1`, [s.org_id]);
  return o?.kind === "business" ? "business" : "nonprofit";
}

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** The email: numbers, change from the period before, and a link into the app. No names, notes or free text. */
export function reportEmail(opts: { name: string; audience: Audience; orgName: string | null; from: string; to: string; tiles: Tile[]; link: string }) {
  const terms = termsFor(opts.audience);
  const label = rangeLabel(opts.from, opts.to);
  const rows = opts.tiles.map((t) => {
    const def = TILES.find((x) => x.key === t.key)!;
    const title = def.label(terms);
    const value = t.key === "revenue" ? money(t.value) : t.value.toLocaleString("en-US");
    const pct = t.parts && !["exits"].includes(t.key) ? null : change(t.value, t.prev);
    const delta = t.parts && t.key !== "exits" ? "" : pct === null ? "new" : pct === 0 ? "same as before" : `${pct > 0 ? "+" : ""}${pct}% vs. the period before`;
    const detail = t.parts?.length ? t.parts.map((p) => `${p.label}: ${p.value}`).join(" · ") : (t.note ?? "");
    return { title, value, delta, detail };
  });
  const heading = `${opts.name}: ${label}`;
  const text = [
    heading,
    opts.orgName ? opts.orgName : "",
    "",
    ...rows.map((r) => `${r.title}: ${r.value}${r.delta ? ` (${r.delta})` : ""}${r.detail ? `\n  ${r.detail}` : ""}`),
    "",
    `See the full dashboard: ${opts.link}`,
    "",
    "You get this because of a scheduled report in Surfdesk. Change or pause it under Reports → Scheduled.",
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
  const cell = "padding:10px 12px;border-bottom:1px solid #e7e5e0;font-family:Arial,sans-serif;font-size:14px;color:#1c1b19";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f1;padding:24px">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border-collapse:separate">
<tr><td style="padding:22px 22px 6px;font-family:Arial,sans-serif">
<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6b6a66">${escapeHtml(opts.orgName ?? "Surfdesk")}</div>
<div style="font-size:20px;font-weight:bold;color:#1c1b19;margin-top:6px">${escapeHtml(opts.name)}</div>
<div style="font-size:14px;color:#6b6a66;margin-top:2px">${escapeHtml(label)}</div></td></tr>
<tr><td style="padding:10px 10px 4px"><table role="presentation" width="100%" style="border-collapse:collapse">
${rows
  .map(
    (r) => `<tr><td style="${cell}">${escapeHtml(r.title)}${r.detail ? `<div style="font-size:12px;color:#6b6a66;margin-top:3px">${escapeHtml(r.detail)}</div>` : ""}</td>
<td style="${cell};text-align:right;white-space:nowrap"><strong style="font-size:18px">${escapeHtml(r.value)}</strong>${r.delta ? `<div style="font-size:12px;color:#6b6a66">${escapeHtml(r.delta)}</div>` : ""}</td></tr>`,
  )
  .join("\n")}
</table></td></tr>
<tr><td style="padding:16px 22px 22px;font-family:Arial,sans-serif">
<a href="${escapeHtml(opts.link)}" style="display:inline-block;background:#1c77b5;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 18px;border-radius:999px">Open the dashboard</a>
<p style="font-size:12px;color:#8a8984;margin:16px 0 0">You get this because of a scheduled report in Surfdesk. Change or pause it under Reports → Scheduled. Counts only: no client names or notes are ever included.</p>
</td></tr></table></body></html>`;
  return { subject: heading.slice(0, 150), text, html };
}

/**
 * Builds and sends one report for a period. `onlyTo` sends just to that address
 * ("Send me one now"). Returns how many emails went out.
 */
export async function sendReport(s: ScheduleRow, range: { from: string; to: string }, opts: { send?: Send; onlyTo?: string } = {}): Promise<number> {
  const send = opts.send ?? sendEmail;
  const tz = await scheduleTz(s);
  const audience = await audienceOf(s);
  const org = s.org_id ? await queryOne<{ name: string }>(`select name from organizations where id = $1`, [s.org_id]) : null;
  const tiles = await computeTiles({ orgId: s.org_id, userId: s.user_id }, tz, range.from, range.to, s.tiles);
  const link = `${appUrl()}/reports?range=custom&from=${range.from}&to=${range.to}`;
  const mail = reportEmail({ name: s.name, audience, orgName: org?.name ?? null, from: range.from, to: range.to, tiles, link });

  let attachments: { filename: string; content: Buffer }[] | undefined;
  if (s.attach_pdf && s.org_id) {
    const { computeMetrics } = await import("@/lib/metrics");
    const { impactPdf } = await import("@/lib/export/impact-pdf");
    const m = await computeMetrics(s.user_id, tz, range.from, range.to, { id: s.org_id, name: org?.name ?? "" });
    // Emailed copies leave out anything that could name someone: top visitors and free-text visit reasons.
    m.topVisitors = [];
    m.byReason = [];
    const info = await queryOne<{ about: string | null; phone: string | null; email: string | null; website: string | null; address: string | null; logo: Buffer | null }>(
      `select about, phone, email, website, address, logo from organizations where id = $1`,
      [s.org_id],
    );
    const owner = await queryOne<{ name: string | null; email: string }>(`select name, email from users where id = $1`, [s.user_id]);
    const pdf = await impactPdf(m, { preparedFor: owner?.name || owner?.email || "", org: info, audience: audience === "business" ? "business" : "nonprofit" });
    attachments = [{ filename: `${audience === "business" ? "insights" : "impact"}-report-${range.from}-to-${range.to}.pdf`, content: Buffer.from(pdf) }];
  }

  const to = opts.onlyTo ? [opts.onlyTo] : await recipientEmails(s);
  let sent = 0;
  for (const address of to) {
    await send({ to: address, subject: mail.subject, text: mail.text, html: mail.html, fromName: org?.name ? `${org.name} via Surfdesk` : undefined, attachments });
    sent++;
  }
  return sent;
}

/** The 5-minute job: sends every report that's due. Never throws. */
export async function runScheduledReports(opts: { send?: Send; notify?: Notify; now?: Date } = {}): Promise<number> {
  const notify = opts.notify ?? defaultNotify;
  let total = 0;
  let schedules: ScheduleRow[] = [];
  try {
    schedules = await query<ScheduleRow>(
      `select s.id, s.user_id, s.org_id, s.name, s.frequency, s.weekday, s.month_day, s.hour, s.recipients, s.attach_pdf, s.tiles
         from report_schedules s join users u on u.id = s.user_id and u.suspended_at is null
         left join organizations o on o.id = s.org_id
        where s.enabled and s.deleted_at is null and (o.id is null or o.suspended_at is null)`,
    );
  } catch (err) {
    console.error("[reports] couldn't load schedules", err instanceof Error ? err.message : err);
    return 0;
  }
  for (const s of schedules) {
    try {
      const due = duePeriod({ frequency: s.frequency, weekday: s.weekday, monthDay: s.month_day, hour: s.hour }, localNow(await scheduleTz(s), opts.now));
      if (!due) continue;
      // Claim the period (or the one retry of a failed send).
      let claim = await queryOne<{ id: string; attempts: number }>(
        `insert into report_deliveries (schedule_id, period, status, attempts) values ($1, $2, 'sending', 1)
         on conflict (schedule_id, period) do nothing returning id, attempts`,
        [s.id, due.period],
      );
      claim ??= await queryOne<{ id: string; attempts: number }>(
        `update report_deliveries set status = 'sending', attempts = attempts + 1, updated_at = now()
          where schedule_id = $1 and period = $2 and status = 'failed' and attempts < 2 and updated_at < now() - interval '4 minutes'
          returning id, attempts`,
        [s.id, due.period],
      );
      if (!claim) continue;
      const done = (status: string, detail: string, recipients = 0) =>
        query(`update report_deliveries set status = $2, detail = $3, recipients = $4, updated_at = now() where id = $1`, [claim!.id, status, detail.slice(0, 300), recipients]);

      if (!(await ownerMayReport(s))) {
        await done("skipped", "The owner can no longer see these reports. Paused.");
        await query(`update report_schedules set enabled = false, updated_at = now() where id = $1`, [s.id]);
        continue;
      }
      const sentToday = await queryOne<{ n: number }>(
        `select coalesce(sum(d.recipients), 0)::int as n from report_deliveries d join report_schedules r on r.id = d.schedule_id
          where ${s.org_id ? "r.org_id = $1" : "r.org_id is null and r.user_id = $1"} and d.status = 'sent' and d.updated_at > now() - interval '1 day'`,
        [s.org_id ?? s.user_id],
      );
      if ((sentToday?.n ?? 0) >= REPORT_LIMITS.emailsPerDay) {
        await done("skipped", "Daily email limit reached");
        continue;
      }
      try {
        const n = await sendReport(s, due, { send: opts.send });
        await done(n ? "sent" : "skipped", n ? `Sent to ${n}` : "Nobody to send to", n);
        total += n;
      } catch (err) {
        console.error("[reports] send failed", s.id, err instanceof Error ? err.message : err);
        await done("failed", "Couldn't send");
        if (claim.attempts >= 2) {
          await notify(s.user_id, { type: "report_failed", title: `"${s.name}" couldn't be sent`, body: "We tried twice. Check the schedule under Reports.", href: "/reports?tab=scheduled" }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("[reports] schedule failed", s.id, err instanceof Error ? err.message : err);
    }
  }
  return total;
}
