/**
 * Transactional email via Resend's HTTP API (no SDK). Needs RESEND_API_KEY
 * and EMAIL_FROM (an address on a domain verified in Resend, e.g.
 * "SonderThreads <no-reply@example.com>"). In local development without
 * them, emails are printed to the server console instead of sent.
 */
export function emailConfigured(): boolean {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return true;
  return process.env.NODE_ENV !== "production";
}

export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.log(`[email] (not sent — no RESEND_API_KEY/EMAIL_FROM)\nTo: ${params.to}\nSubject: ${params.subject}\n\n${params.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, text: params.text }),
  });
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${await res.text().catch(() => "")}`);
  }
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
