/**
 * Transactional email via Resend's HTTP API (no SDK). Needs RESEND_API_KEY
 * and EMAIL_FROM (an address on a domain verified in Resend, e.g.
 * "Surfdesk <no-reply@example.com>"). In local development without
 * them, emails are printed to the server console instead of sent.
 */
export function emailConfigured(): boolean {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return true;
  return process.env.NODE_ENV !== "production";
}

/** Escape text for an HTML email body. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail(params: { to: string; subject: string; text: string; html?: string; replyTo?: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.log(`[email] (not sent — no RESEND_API_KEY/EMAIL_FROM)\nTo: ${params.to}\nSubject: ${params.subject}\n\n${params.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${await res.text().catch(() => "")}`);
  }
  await import("@/lib/heartbeat").then((h) => h.heartbeat("email_sent_at")).catch(() => undefined);
}

/**
 * The public URL used in emailed links. Never built from the request's Host
 * header — an attacker could set that and get a victim's reset link pointed
 * at their own site. APP_URL wins; Vercel sets VERCEL_PROJECT_PRODUCTION_URL
 * (your production domain) automatically.
 */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

type BatchEmail = { to: string; subject: string; text: string; html?: string; replyTo?: string };

/**
 * Many emails at once (bulk invites) through Resend's batch endpoint: up to 100 per request,
 * one request at a time with a pause between, retrying once on a rate limit (429).
 * Returns which ones were accepted (by index). Never throws.
 */
export async function sendEmailBatch(emails: BatchEmail[]): Promise<boolean[]> {
  const sent = emails.map(() => false);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.log(`[email] (batch not sent — no RESEND_API_KEY/EMAIL_FROM) ${emails.length} emails`);
    return sent;
  }
  for (let start = 0; start < emails.length; start += 100) {
    const chunk = emails.slice(start, start + 100);
    const body = JSON.stringify(
      chunk.map((e) => ({
        from,
        to: e.to,
        subject: e.subject,
        text: e.text,
        ...(e.html ? { html: e.html } : {}),
        ...(e.replyTo ? { reply_to: e.replyTo } : {}),
      })),
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body,
        });
        if (res.ok) {
          chunk.forEach((_, i) => (sent[start + i] = true));
          break;
        }
        console.error("[email] batch failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
        if (res.status !== 429) break;
      } catch (err) {
        console.error("[email] batch failed", err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (start + 100 < emails.length) await new Promise((r) => setTimeout(r, 600));
  }
  if (sent.some(Boolean)) await import("@/lib/heartbeat").then((h) => h.heartbeat("email_sent_at")).catch(() => undefined);
  return sent;
}
