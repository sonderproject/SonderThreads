import type { User } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { appUrl, escapeHtml, sendEmail } from "@/lib/email";
import { logEvent, alertOwner } from "@/lib/events";

/**
 * Sign-up confirmation and password-reset emails sent by the app itself (Resend, EMAIL_FROM),
 * used when Supabase can't send them (its SMTP sender isn't a verified domain, an outage) or
 * when the CAPTCHA backup is in use. Supabase makes the one-time link and code
 * (auth.admin.generateLink, nothing is emailed by Supabase); the link goes to /auth/confirm
 * like Supabase's own emails, and the 6-digit code works on the check-email page.
 */
export type AuthEmailKind = "signup" | "resend" | "recovery";
export type AuthEmailResult = { status: "sent"; user: User | null } | { status: "exists" | "no_user" | "failed"; user: null };

/** Supabase couldn't send its email (SMTP problem): worth retrying through the app's own sender. */
export function isEmailSendError(error: { message?: string; code?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  return /sending (confirmation|recovery|magic link|invite)? ?email|smtp|gomail/i.test(error.message ?? "") || (error.status === 500 && error.code === "unexpected_failure");
}

export async function sendAuthEmail(kind: AuthEmailKind, email: string, opts: { password?: string; next?: string } = {}): Promise<AuthEmailResult> {
  const admin = createSupabaseAdmin();
  const next = opts.next || (kind === "recovery" ? "/reset-password" : "/");
  const redirectTo = `${appUrl()}/auth/confirm?next=${encodeURIComponent(next)}`;
  const { data, error } =
    kind === "signup"
      ? await admin.auth.admin.generateLink({ type: "signup", email, password: opts.password ?? "", options: { redirectTo } })
      : kind === "recovery"
        ? await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } })
        : await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  if (error || !data?.properties) {
    const code = error?.code ?? "";
    if (code === "email_exists" || code === "user_already_exists") return { status: "exists", user: null };
    if (code === "user_not_found" || error?.status === 404) return { status: "no_user", user: null };
    await logEvent("auth.email_link_failed", `Couldn't make the ${kind} link: ${error?.message ?? "no link"}`, { level: "error", email, meta: { code } });
    return { status: "failed", user: null };
  }
  const p = data.properties;
  const link = `${appUrl()}/auth/confirm?${new URLSearchParams({ token_hash: p.hashed_token, type: p.verification_type, next })}`;
  const code = p.email_otp;
  const isReset = kind === "recovery";
  const subject = isReset ? "Reset your Surfdesk password" : "Confirm your email for Surfdesk";
  const lead = isReset
    ? "Someone (hopefully you) asked to reset your Surfdesk password. Use the button to choose a new one."
    : "Welcome to Surfdesk! Confirm your email to finish setting up your account.";
  const button = isReset ? "Choose a new password" : "Confirm my email";
  const text = [
    lead,
    "",
    `${button}: ${link}`,
    ...(code && !isReset ? ["", `Or enter this code on the sign-up page: ${code}`] : []),
    "",
    isReset ? "If you didn't ask for this, you can ignore this email; your password stays the same." : "If you didn't sign up, you can ignore this email.",
  ].join("\n");
  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#141412;max-width:480px">
<p>${escapeHtml(lead)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c77b5;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:600">${escapeHtml(button)}</a></p>
${code && !isReset ? `<p>Or enter this code on the sign-up page: <strong style="font-size:18px;letter-spacing:2px">${escapeHtml(code)}</strong></p>` : ""}
<p style="color:#6e5f4d;font-size:13px">${isReset ? "If you didn't ask for this, you can ignore this email; your password stays the same." : "If you didn't sign up, you can ignore this email."}</p>
</div>`;
  try {
    await sendEmail({ to: email, subject, text, html });
  } catch (err) {
    await logEvent("email.failed", `${kind} email failed: ${err instanceof Error ? err.message : String(err)}`, { level: "error", email });
    return { status: "failed", user: null };
  }
  await logEvent("auth.email_by_app", `${kind} email sent by the app`, { level: "warn", email });
  await alertOwner(
    "Sign-up and reset emails are going out through the app",
    [
      "Supabase couldn't send its own sign-up/reset emails (or the security-check backup is in use), so Surfdesk sent them through Resend instead. Nobody is blocked.",
      "To fix Supabase's own sending: Authentication → SMTP Settings → Sender email must be on a domain verified in Resend (no-reply@strynd.com today).",
    ],
    { everyMinutes: 720 },
  );
  return { status: "sent", user: data.user ?? null };
}
