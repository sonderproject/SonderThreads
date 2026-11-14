import { query, queryOne } from "@/lib/db/client";
import { appUrl, escapeHtml, sendEmail } from "@/lib/email";
import { ownerEmails } from "@/lib/owner";

export type EventLevel = "info" | "warn" | "error";

/**
 * Records something the owner should know about (shown in /owner). Never
 * throws: logging must not break the request it's describing.
 */
export async function logEvent(
  kind: string,
  message: string,
  opts: { level?: EventLevel; email?: string | null; path?: string | null; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await query(`insert into app_events (kind, level, message, email, path, meta) values ($1, $2, $3, $4, $5, $6)`, [
      kind,
      opts.level ?? "info",
      message.slice(0, 2000),
      opts.email ?? null,
      opts.path ?? null,
      opts.meta ? JSON.stringify(opts.meta) : null,
    ]);
  } catch (err) {
    console.error("[events] log failed", kind, err);
  }
}

/** Throwaway sign-ups: Gmail addresses with dots sprinkled through them (e.g. j.o.h.n.s.m.i.t.h@gmail.com). */
export function isLikelyBot(email: string | null | undefined): boolean {
  if (!email) return false;
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return false;
  return (domain === "gmail.com" || domain === "googlemail.com") && (local.match(/\./g)?.length ?? 0) >= 3;
}

/**
 * Emails the owner. `key` makes it send at most once per key (e.g. once per
 * stuck sign-up), and `everyMinutes` at most once per window per kind.
 */
export async function alertOwner(
  subject: string,
  lines: string[],
  opts: { key?: string; everyMinutes?: number } = {},
): Promise<void> {
  try {
    if (opts.key && (await queryOne(`select 1 from app_events where kind = 'alert' and meta->>'key' = $1`, [opts.key]))) return;
    if (
      opts.everyMinutes &&
      (await queryOne(
        `select 1 from app_events where kind = 'alert' and message = $1 and created_at > now() - make_interval(mins => $2)`,
        [subject, opts.everyMinutes],
      ))
    )
      return;
    await logEvent("alert", subject, { meta: { key: opts.key ?? null } });
    const link = `${appUrl()}/owner`;
    const text = `${lines.join("\n")}\n\nOpen the command center: ${link}`;
    const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6">${lines
      .map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`)
      .join("")}<p style="margin:16px 0 0"><a href="${link}">Open the command center</a></p></div>`;
    await Promise.all(ownerEmails().map((to) => sendEmail({ to, subject: `Surfdesk: ${subject}`, text, html })));
  } catch (err) {
    console.error("[events] owner alert failed", subject, err);
  }
}
